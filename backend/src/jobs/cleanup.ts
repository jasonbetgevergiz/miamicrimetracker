/**
 * Cleanup Job
 * Remove stale data
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

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
        lastUpdate: { lt: thirtyMinutesAgo },
      },
    });

    // Optionally archive old resolved incidents
    const incidentsArchived = 0;

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
