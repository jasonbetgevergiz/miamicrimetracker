/**
 * Statistics API Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getCache, setCache } from '../lib/redis';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../lib/logger';

const router = Router();

/**
 * Query schema for dashboard stats
 */
const statsQuerySchema = z.object({
  period: z.enum(['24h', '7d', '30d']).default('24h'),
});

/**
 * GET /api/stats/dashboard
 * Get dashboard statistics for specified period
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const { period } = statsQuerySchema.parse(req.query);

    // Check cache first
    const cacheKey = `stats:dashboard:${period}`;
    const cached = await getCache(cacheKey);

    if (cached) {
      logger.debug('Stats cache hit', { period });
      return res.json(cached);
    }

    // Calculate fresh stats
    logger.debug('Stats cache miss, calculating', { period });
    const stats = await calculateDashboardStats(period);

    // Cache for 5 minutes
    await setCache(cacheKey, stats, 300);

    res.json(stats);
  })
);

/**
 * GET /api/stats/timeline
 * Get timeline data for charts
 */
const timelineQuerySchema = z.object({
  period: z.enum(['24h', '7d']).default('24h'),
  granularity: z.enum(['hourly', 'daily']).default('hourly'),
});

router.get(
  '/timeline',
  asyncHandler(async (req, res) => {
    const query = timelineQuerySchema.parse(req.query);

    const now = new Date();
    const startDate =
      query.period === '24h'
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const incidents = await prisma.incident.findMany({
      where: { reportedAt: { gte: startDate } },
      select: { type: true, severity: true, reportedAt: true },
    });

    const timeline = generateTrendData(incidents, query.period, startDate);

    res.json({
      data: timeline,
      meta: {
        period: query.period,
        granularity: query.granularity,
        totalIncidents: incidents.length,
      },
    });
  })
);

/**
 * GET /api/stats/status
 * Get current system status (GREEN/YELLOW/RED)
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const criticalCount = await prisma.incident.count({
      where: {
        severity: 'critical',
        reportedAt: { gte: oneHourAgo },
      },
    });

    const activeEmergencies = await prisma.incident.count({
      where: {
        type: 'emergency',
        status: 'active',
      },
    });

    let status: 'GREEN' | 'YELLOW' | 'RED';
    let reason: string;

    if (criticalCount > 5 || activeEmergencies > 3) {
      status = 'RED';
      reason = 'Multiple critical incidents or active emergencies';
    } else if (criticalCount >= 3 || activeEmergencies > 0) {
      status = 'YELLOW';
      reason = 'Elevated incident activity detected';
    } else {
      status = 'GREEN';
      reason = 'Normal incident levels';
    }

    res.json({
      status,
      reason,
      metrics: {
        criticalIncidentsLastHour: criticalCount,
        activeEmergencies,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Calculate dashboard statistics
 */
async function calculateDashboardStats(period: '24h' | '7d' | '30d') {
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
    period,
    summary: {
      totalIncidents,
      criticalIncidents,
      activeIncidents,
      resolvedIncidents,
    },
    byType: incidentsByType,
    bySeverity: incidentsBySeverity,
    trend: incidentsTrend,
    topLocations,
    recentSpikes,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Generate trend data
 */
function generateTrendData(incidents: any[], period: string, startDate: Date): any[] {
  const trend: any[] = [];

  if (period === '24h') {
    // Hourly granularity
    for (let i = 0; i < 24; i++) {
      const hourStart = new Date(startDate.getTime() + i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const count = incidents.filter(
        (inc) => inc.reportedAt >= hourStart && inc.reportedAt < hourEnd
      ).length;

      trend.push({
        time: hourStart.toISOString(),
        label: hourStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        count,
      });
    }
  } else {
    // Daily granularity
    const days = period === '7d' ? 7 : 30;
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const count = incidents.filter(
        (inc) => inc.reportedAt >= dayStart && inc.reportedAt < dayEnd
      ).length;

      trend.push({
        time: dayStart.toISOString(),
        label: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      });
    }
  }

  return trend;
}

/**
 * Detect anomalous spikes
 */
function detectSpikes(incidents: any[], period: string): any[] {
  if (period !== '24h') return [];

  const now = new Date();
  const hourCounts: number[] = [];

  // Calculate counts for each hour
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    const count = incidents.filter(
      (inc) => inc.reportedAt >= hourStart && inc.reportedAt < hourEnd
    ).length;

    hourCounts.push(count);
  }

  // Calculate mean and std dev
  const mean = hourCounts.reduce((a, b) => a + b, 0) / hourCounts.length;
  const variance =
    hourCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / hourCounts.length;
  const stdDev = Math.sqrt(variance);

  // Detect spikes (> 2 std dev above mean)
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

export default router;
