/**
 * Incident Data Fetching Job
 *
 * Fetches incident data from external sources (Miami PD, emergency feeds, etc.)
 * and stores in the database. Broadcasts new incidents via WebSocket.
 */

import { Server as SocketIOServer } from 'socket.io';
import axios from 'axios';
import { prisma } from '../utils/db';
import { logger } from '../utils/logger';
import { broadcastIncidentNew } from '../websocket';

/**
 * Process incident fetch job
 */
export async function processIncidentFetch(
  data: { source: string },
  io: SocketIOServer
): Promise<{ processed: number; created: number }> {
  logger.info('Fetching incidents', data);

  try {
    // Get source configuration
    const source = await prisma.source.findFirst({
      where: {
        name: data.source,
        isActive: true,
      },
    });

    if (!source || !source.apiEndpoint) {
      logger.warn('Source not found or has no API endpoint', data);
      return { processed: 0, created: 0 };
    }

    // Fetch data from external API
    const incidents = await fetchFromSource(source);

    let created = 0;

    // Process each incident
    for (const incidentData of incidents) {
      try {
        // Check if incident already exists
        const existing = incidentData.externalId
          ? await prisma.incident.findUnique({
              where: { externalId: incidentData.externalId },
            })
          : null;

        if (!existing) {
          // Create new incident
          const incident = await prisma.incident.create({
            data: {
              ...incidentData,
              sourceId: source.id,
            },
            include: {
              source: true,
            },
          });

          created++;

          // Broadcast new incident
          broadcastIncidentNew(incident);
        }
      } catch (error) {
        logger.error('Failed to process incident:', error);
      }
    }

    // Update source last fetch time
    await prisma.source.update({
      where: { id: source.id },
      data: { lastFetchAt: new Date() },
    });

    logger.info('Incidents fetched and processed', {
      source: data.source,
      processed: incidents.length,
      created,
    });

    return { processed: incidents.length, created };
  } catch (error) {
    logger.error('Incident fetch job failed:', error);
    throw error;
  }
}

/**
 * Fetch incidents from external source
 * This is a stub implementation - in production, this would integrate with real APIs
 */
async function fetchFromSource(source: any): Promise<any[]> {
  // For demo purposes, return empty array
  // In production, this would fetch from Miami PD Open Data API, etc.

  try {
    // Example: Fetch from Miami-Dade Open Data
    // const response = await axios.get(source.apiEndpoint, {
    //   params: {
    //     $limit: 100,
    //     $order: 'date DESC',
    //   },
    // });

    // Transform and return incidents
    // return response.data.map(transformMiamiPDIncident);

    // For now, return empty to avoid external API calls
    return [];
  } catch (error) {
    logger.error('Failed to fetch from source:', error);
    return [];
  }
}

/**
 * Transform Miami PD data to our incident schema
 * Example transformation function
 */
function transformMiamiPDIncident(data: any): any {
  return {
    externalId: data.case_number || data.id,
    type: mapIncidentType(data.offense_type),
    category: data.offense_category || 'unknown',
    severity: calculateSeverity(data),
    title: data.offense_description || 'Incident',
    description: data.narrative,
    location: data.location_name || 'Miami',
    latitude: parseFloat(data.latitude) || 25.7617,
    longitude: parseFloat(data.longitude) || -80.1918,
    address: data.address,
    reportedAt: new Date(data.date_reported || data.date),
    tags: extractTags(data),
    metadata: {
      raw: data,
    },
  };
}

/**
 * Map external incident types to our schema
 */
function mapIncidentType(type: string): string {
  const normalized = type?.toLowerCase() || '';

  if (normalized.includes('fire')) return 'fire';
  if (normalized.includes('accident') || normalized.includes('traffic'))
    return 'accident';
  if (normalized.includes('emergency') || normalized.includes('medical'))
    return 'emergency';

  return 'crime';
}

/**
 * Calculate severity based on incident data
 */
function calculateSeverity(data: any): string {
  const type = data.offense_type?.toLowerCase() || '';

  if (
    type.includes('murder') ||
    type.includes('shooting') ||
    type.includes('armed')
  ) {
    return 'critical';
  }

  if (
    type.includes('assault') ||
    type.includes('robbery') ||
    type.includes('burglary')
  ) {
    return 'high';
  }

  if (type.includes('theft') || type.includes('vandalism')) {
    return 'medium';
  }

  return 'low';
}

/**
 * Extract relevant tags from incident data
 */
function extractTags(data: any): string[] {
  const tags: string[] = [];

  if (data.officer_involved) tags.push('officer-involved');
  if (data.weapon_used) tags.push('weapon');
  if (data.gang_related) tags.push('gang-related');

  return tags;
}
