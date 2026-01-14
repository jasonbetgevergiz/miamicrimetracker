/**
 * Transit Data Fetching Job
 *
 * Fetches live Miami-Dade transit vehicle locations
 * and updates the database. Broadcasts updates via WebSocket.
 */

import { Server as SocketIOServer } from 'socket.io';
import axios from 'axios';
import { prisma } from '../utils/db';
import { logger } from '../utils/logger';
import { broadcastTransitUpdate } from '../websocket';

/**
 * Process transit fetch job
 */
export async function processTransitFetch(
  data: any,
  io: SocketIOServer
): Promise<{ processed: number; updated: number }> {
  logger.info('Fetching transit data');

  try {
    // Fetch live transit data
    const vehicles = await fetchTransitData();

    let updated = 0;

    // Process each vehicle
    for (const vehicleData of vehicles) {
      try {
        // Upsert vehicle data
        await prisma.transitVehicle.upsert({
          where: { vehicleId: vehicleData.vehicleId },
          create: vehicleData,
          update: {
            ...vehicleData,
            updatedAt: new Date(),
          },
        });

        updated++;
      } catch (error) {
        logger.error('Failed to process transit vehicle:', error);
      }
    }

    // Broadcast transit update if we have data
    if (vehicles.length > 0) {
      broadcastTransitUpdate(vehicles);
    }

    logger.info('Transit data fetched and processed', {
      processed: vehicles.length,
      updated,
    });

    return { processed: vehicles.length, updated };
  } catch (error) {
    logger.error('Transit fetch job failed:', error);
    throw error;
  }
}

/**
 * Fetch live transit data from Miami-Dade Transit API
 * This is a stub implementation - in production, integrate with real API
 */
async function fetchTransitData(): Promise<any[]> {
  // For demo purposes, return empty array
  // In production, this would fetch from Miami-Dade Transit Tracker API

  try {
    // Example API integration:
    // const response = await axios.get(process.env.TRANSIT_API_URL!, {
    //   headers: {
    //     'Authorization': `Bearer ${process.env.TRANSIT_API_KEY}`,
    //   },
    // });

    // Transform and return vehicles
    // return response.data.vehicles.map(transformTransitVehicle);

    // For now, return empty to avoid external API calls
    return [];
  } catch (error) {
    logger.error('Failed to fetch transit data:', error);
    return [];
  }
}

/**
 * Transform transit API data to our schema
 */
function transformTransitVehicle(data: any): any {
  return {
    vehicleId: data.vehicle_id || data.id,
    routeId: data.route_id,
    routeName: data.route_name || `Route ${data.route_id}`,
    vehicleType: determineVehicleType(data),
    latitude: parseFloat(data.latitude),
    longitude: parseFloat(data.longitude),
    heading: data.heading ? parseInt(data.heading) : null,
    speed: data.speed ? parseFloat(data.speed) : null,
    status: determineStatus(data),
    occupancy: data.occupancy || null,
    lastUpdate: new Date(data.timestamp || Date.now()),
  };
}

/**
 * Determine vehicle type from route or vehicle data
 */
function determineVehicleType(data: any): string {
  const routeId = data.route_id?.toLowerCase() || '';
  const vehicleType = data.vehicle_type?.toLowerCase() || '';

  if (vehicleType.includes('rail') || routeId.includes('rail')) {
    return 'metrorail';
  }

  if (vehicleType.includes('mover') || routeId.includes('mover')) {
    return 'metromover';
  }

  return 'bus';
}

/**
 * Determine vehicle status
 */
function determineStatus(data: any): string {
  if (data.delay_minutes > 10) return 'delayed';
  if (data.status === 'offline' || !data.active) return 'offline';
  return 'active';
}
