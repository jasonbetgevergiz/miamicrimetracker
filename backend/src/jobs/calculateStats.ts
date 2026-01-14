/**
 * Stats Calculation Job
 */

import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma';
import { clearCachePattern } from '../lib/redis';
import { logger } from '../lib/logger';
import { broadcastStatsUpdate } from '../websocket';

/**
 * Process stats calculation job
 */
export async function processStatsCalculation(
  data: any,
  io: SocketIOServer
): Promise<{ calculated: string[] }> {
  logger.info('Calculating dashboard stats');

  const periods: Array<'24h' | '7d' | '30d'> = ['24h', '7d', '30d'];
  const calculated: string[] = [];

  try {
    for (const period of periods) {
      const stats = await calculateStatsForPeriod(period);

      await prisma.dashboardStats.upsert({
        where: { period },
        create: {
          period,
          ...stats,
        },
        update: {
          ...stats,
          calculatedAt: new Date(),
        },
      });

      calculated.push(period);

      // Broadcast 24h stats (most commonly used)
      if (period === '24h') {
        broadcastStatsUpdate({
          period,
          ...stats,
          calculatedAt: new Date().toISOString(),
        });
      }
    }

    // Clear cache
    await clearCachePattern('stats:dashboard:*');

    logger.info('Dashboard stats calculated', { periods: calculated });

    return { calculated };
  } catch (error) {
    logger.error('Stats calculation job failed:', error);
    throw error;
  }
}

/**
 * Calculate stats for specific period
 */
async function calculateStatsForPeriod(period: '24h' | '7d' | '30d') {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  const incidents = await prisma.incident.findMany({
    where: { reportedAt: { gte: startDate } },
    select: {
      id: true,
      type: true,
      severity: true,
      status: true,
      location: true,
      reportedAt: true,
    },
  });

  // Summary counts
  const totalIncidents = incidents.length;
  const criticalIncidents = incidents.filter((i) => i.severity === 'critical').length;
  const activeIncidents = incidents.filter((i) => i.status === 'active').length;
  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved').length;

  // Group by type
  const incidentsByType: Record<string, number> = {};
  incidents.forEach((i) => {
    incidentsByType[i.type] = (incidentsByType[i.type] || 0) + 1;
  });

  // Group by severity
  const incidentsBySeverity: Record<string, number> = {};
  incidents.forEach((i) => {
    incidentsBySeverity[i.severity] = (incidentsBySeverity[i.severity] || 0) + 1;
  });

  // Trend data
  const incidentsTrend = generateTrendData(incidents, period, startDate);

  // Top locations
  const locationCounts: Record<string, number> = {};
  incidents.forEach((i) => {
    locationCounts[i.location] = (locationCounts[i.location] || 0) + 1;
  });

  const topLocations = Object.entries(locationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([location, count]) => ({ location, count }));

  // Detect spikes
  const recentSpikes = detectSpikes(incidents, period);

  return {
    totalIncidents,
    criticalIncidents,
    activeIncidents,
    resolvedIncidents,
    incidentsByType,
    incidentsBySeverity,
    incidentsTrend,
    topLocations,
    recentSpikes,
  };
}

function generateTrendData(incidents: any[], period: string, startDate: Date): any[] {
  const trend: any[] = [];

  if (period === '24h') {
    for (let i = 0; i < 24; i++) {
      const hourStart = new Date(startDate.getTime() + i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const count = incidents.filter(
        (inc) => inc.reportedAt >= hourStart && inc.reportedAt < hourEnd
      ).length;

      trend.push({ time: hourStart.toISOString(), count });
    }
  } else {
    const days = period === '7d' ? 7 : 30;
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const count = incidents.filter(
        (inc) => inc.reportedAt >= dayStart && inc.reportedAt < dayEnd
      ).length;

      trend.push({ time: dayStart.toISOString(), count });
    }
  }

  return trend;
}

function detectSpikes(incidents: any[], period: string): any[] {
  if (period !== '24h') return [];

  const now = new Date();
  const hourCounts: number[] = [];

  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    const count = incidents.filter(
      (inc) => inc.reportedAt >= hourStart && inc.reportedAt < hourEnd
    ).length;

    hourCounts.push(count);
  }

  const mean = hourCounts.reduce((a, b) => a + b, 0) / hourCounts.length;
  const variance =
    hourCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / hourCounts.length;
  const stdDev = Math.sqrt(variance);

  const spikes: any[] = [];
  hourCounts.forEach((count, index) => {
    if (count > mean + 2 * stdDev && count > 5) {
      const hourStart = new Date(now.getTime() - (23 - index) * 60 * 60 * 1000);
      spikes.push({
        time: hourStart.toISOString(),
        count,
        normal: Math.round(mean),
        deviation: ((count - mean) / stdDev).toFixed(1),
      });
    }
  });

  return spikes;
}
