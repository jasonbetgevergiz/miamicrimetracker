/**
 * Sources API Routes
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/sources
 * Get all data sources with incident counts
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const sources = await prisma.source.findMany({
      orderBy: { name: 'asc' },
    });

    const sourcesWithCounts = await Promise.all(
      sources.map(async (source) => {
        const totalIncidents = await prisma.incident.count({
          where: { sourceId: source.id },
        });

        const recentIncidents = await prisma.incident.count({
          where: {
            sourceId: source.id,
            reportedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        return {
          ...source,
          totalIncidents,
          recentIncidents,
        };
      })
    );

    res.json({
      data: sourcesWithCounts,
      meta: {
        totalSources: sources.length,
        activeSources: sources.filter((s) => s.isActive).length,
      },
    });
  })
);

/**
 * GET /api/sources/:id
 * Get specific source details
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const source = await prisma.source.findUnique({
      where: { id },
    });

    if (!source) {
      throw new AppError(404, 'Source not found');
    }

    const incidentCount = await prisma.incident.count({
      where: { sourceId: id },
    });

    res.json({
      ...source,
      totalIncidents: incidentCount,
    });
  })
);

export default router;
