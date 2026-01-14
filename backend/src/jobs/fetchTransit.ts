/**
 * Transit Data Fetching Job
 */

import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
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
    // TODO: Fetch from Miami-Dade Transit API
    // const vehicles = await fetchTransitFromAPI();
    // For now, return empty array
    const vehicles: any[] = [];

    let updated = 0;

    for (const vehicleData of vehicles) {
      try {
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

    if (vehicles.length > 0) {
      broadcastTransitUpdate(vehicles);
    }

    logger.info('Transit data fetched', {
      processed: vehicles.length,
      updated,
    });

    return { processed: vehicles.length, updated };
  } catch (error) {
    logger.error('Transit fetch job failed:', error);
    throw error;
  }
}
