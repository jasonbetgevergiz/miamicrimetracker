/**
 * Incident Data Fetching Job
 */

import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
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

    // TODO: Fetch from external API
    // const incidents = await fetchFromExternalAPI(source);
    // For now, return empty array
    const incidents: any[] = [];

    let created = 0;

    for (const incidentData of incidents) {
      try {
        const existing = incidentData.externalId
          ? await prisma.incident.findUnique({
              where: { externalId: incidentData.externalId },
            })
          : null;

        if (!existing) {
          const incident = await prisma.incident.create({
            data: {
              ...incidentData,
              sourceId: source.id,
            },
            include: { source: true },
          });

          created++;
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

    logger.info('Incidents fetched', {
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
