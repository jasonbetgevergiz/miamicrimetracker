/**
 * Cleanup Job
 *
 * Periodically cleans up old data to prevent database bloat
 * - Removes stale transit vehicle records
 * - Archives or removes old resolved incidents (optional)
 */

import { prisma } from '../utils/db';
import { logger } from '../utils/logger';

/**
 * Process cleanup job
 */
export async function processCleanup(data: any): Promise<{
  transitRemoved: number;
  incidentsArchived: number;
}> {
  logger.info('Running cleanup job');

  try {
    // Remove transit vehicles not updated in last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const { count: transitRemoved } = await prisma.transitVehicle.deleteMany({
      where: {
        lastUpdate: {
          lt: thirtyMinutesAgo,
        },
      },
    });

    // Optionally archive old resolved incidents (older than 90 days)
    // For now, we'll keep all incidents
    const incidentsArchived = 0;

    // Could implement archiving logic:
    // const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    // const oldIncidents = await prisma.incident.findMany({
    //   where: {
    //     status: 'resolved',
    //     resolvedAt: {
    //       lt: ninetyDaysAgo,
    //     },
    //   },
    // });
    // Archive to separate table or mark as archived

    logger.info('Cleanup completed', {
      transitRemoved,
      incidentsArchived,
    });

    return { transitRemoved, incidentsArchived };
  } catch (error) {
    logger.error('Cleanup job failed:', error);
    throw error;
  }
}
