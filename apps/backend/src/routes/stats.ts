/**
 * Statistics API Routes
 *
 * Provides aggregated statistics and analytics for the dashboard
 * including incident counts, trends, anomaly detection, and more.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Query parameter validation schema
 */
const statsQuerySchema = z.object({
  period: z.enum(['24h', '7d', '30d']).default('24h'),
});

/**
 * GET /api/stats/dashboard
 *
 * Get comprehensive dashboard statistics for the specified period
 *
 * Query Parameters:
 * - period: Time period (24h, 7d, 30d) - default: 24h
 *
 * Response:
 * - period: Selected period
 * - summary: Overall counts (total, critical, active, resolved)
 * - byType: Breakdown by incident type
 * - bySeverity: Breakdown by severity level
 * - trend: Time-series data
 * - topLocations: Most incident-prone areas
 * - recentSpikes: Detected anomalies
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    const { period } = statsQuerySchema.parse(req.query);

    // Check if we have cached stats
    const cached = await prisma.dashboardStats.findUnique({
      where: { period },
    });

    // If cache is fresh (< 5 minutes old), return it
    if (cached && cached.calculatedAt > new Date(Date.now() - 5 * 60 * 1000)) {
      logger.debug('Returning cached stats', { period });
      return res.json({
        period,
        summary: {
          totalIncidents: cached.totalIncidents,
          criticalIncidents: cached.criticalIncidents,
          activeIncidents: cached.activeIncidents,
          resolvedIncidents: cached.resolvedIncidents,
        },
        byType: cached.incidentsByType,
        bySeverity: cached.incidentsBySeverity,
        trend: cached.incidentsTrend,
        topLocations: cached.topLocations,
        recentSpikes: cached.recentSpikes,
        calculatedAt: cached.calculatedAt.toISOString(),
      });
    }

    // Calculate fresh stats
    logger.info('Calculating fresh stats', { period });
    const stats = await calculateDashboardStats(period);

    // Cache the results
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

    res.json({
      period,
      ...stats,
      calculatedAt: new Date().toISOString(),
    });
  })
);

/**
 * Calculate dashboard statistics for a given period
 */
async function calculateDashboardStats(period: '24h' | '7d' | '30d') {
  // Determine date range
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

  // Get all incidents in period
  const incidents = await prisma.incident.findMany({
    where: {
      reportedAt: {
        gte: startDate,
      },
    },
    select: {
      id: true,
      type: true,
      severity: true,
      status: true,
      location: true,
      reportedAt: true,
    },
  });

  // Calculate summary counts
  const totalIncidents = incidents.length;
  const criticalIncidents = incidents.filter(i => i.severity === 'critical').length;
  const activeIncidents = incidents.filter(i => i.status === 'active').length;
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved').length;

  // Group by type
  const incidentsByType: Record<string, number> = {};
  incidents.forEach((incident) => {
    incidentsByType[incident.type] = (incidentsByType[incident.type] || 0) + 1;
  });

  // Group by severity
  const incidentsBySeverity: Record<string, number> = {};
  incidents.forEach((incident) => {
    incidentsBySeverity[incident.severity] =
      (incidentsBySeverity[incident.severity] || 0) + 1;
  });

  // Generate trend data
  const incidentsTrend = generateTrendData(incidents, period, startDate);

  // Top locations
  const locationCounts: Record<string, number> = {};
  incidents.forEach((incident) => {
    locationCounts[incident.location] =
      (locationCounts[incident.location] || 0) + 1;
  });

  const topLocations = Object.entries(locationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([location, count]) => ({ location, count }));

  // Detect spikes (simple anomaly detection)
  const recentSpikes = detectSpikes(incidents, period);

  return {
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
    totalIncidents,
    criticalIncidents,
    activeIncidents,
    resolvedIncidents,
    incidentsByType,
    incidentsBySeverity,
    incidentsTrend,
  };
}

/**
 * Generate time-series trend data
 */
function generateTrendData(
  incidents: any[],
  period: '24h' | '7d' | '30d',
  startDate: Date
): any[] {
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
        label: hourStart.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
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
        label: dayStart.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        count,
      });
    }
  }

  return trend;
}

/**
 * Simple spike detection algorithm
 * Detects when incident count is significantly higher than normal
 */
function detectSpikes(incidents: any[], period: '24h' | '7d' | '30d'): any[] {
  const spikes: any[] = [];

  // For 24h period, check each hour
  if (period === '24h') {
    const now = new Date();
    const hourCounts: number[] = [];

    // Calculate counts for each hour in last 24h
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const count = incidents.filter(
        (inc) => inc.reportedAt >= hourStart && inc.reportedAt < hourEnd
      ).length;

      hourCounts.push(count);
    }

    // Calculate mean and standard deviation
    const mean = hourCounts.reduce((a, b) => a + b, 0) / hourCounts.length;
    const variance =
      hourCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      hourCounts.length;
    const stdDev = Math.sqrt(variance);

    // Detect spikes (> 2 standard deviations above mean)
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
  }

  return spikes;
}

/**
 * GET /api/stats/timeline
 *
 * Get detailed timeline data for visualization
 *
 * Query Parameters:
 * - period: Time period (24h, 7d) - default: 24h
 * - granularity: hourly or daily - default: hourly
 *
 * Response:
 * - data: Array of time points with counts and breakdowns
 */
const timelineQuerySchema = z.object({
  period: z.enum(['24h', '7d']).default('24h'),
  granularity: z.enum(['hourly', 'daily']).default('hourly'),
});

router.get(
  '/timeline',
  asyncHandler(async (req: Request, res: Response) => {
    const query = timelineQuerySchema.parse(req.query);

    const now = new Date();
    const startDate =
      query.period === '24h'
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const incidents = await prisma.incident.findMany({
      where: {
        reportedAt: {
          gte: startDate,
        },
      },
      select: {
        type: true,
        severity: true,
        reportedAt: true,
      },
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
 *
 * Get current system status (GREEN/YELLOW/RED)
 *
 * Response:
 * - status: Overall status indicator
 * - reason: Explanation for the status
 * - metrics: Key metrics that determined the status
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Count critical incidents in last hour
    const criticalCount = await prisma.incident.count({
      where: {
        severity: 'critical',
        reportedAt: {
          gte: oneHourAgo,
        },
      },
    });

    // Count active emergencies
    const activeEmergencies = await prisma.incident.count({
      where: {
        type: 'emergency',
        status: 'active',
      },
    });

    // Determine status
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

export default router;
