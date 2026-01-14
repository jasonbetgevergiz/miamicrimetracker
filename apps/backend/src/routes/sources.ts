/**
 * Sources API Routes
 *
 * Provides information about data sources and their status
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../utils/db';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/sources
 *
 * Get list of all data sources and their status
 *
 * Response:
 * - data: Array of source objects
 * - meta: Metadata about sources
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const sources = await prisma.source.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    // Count incidents per source
    const sourcesWithCounts = await Promise.all(
      sources.map(async (source) => {
        const incidentCount = await prisma.incident.count({
          where: { sourceId: source.id },
        });

        const recentCount = await prisma.incident.count({
          where: {
            sourceId: source.id,
            reportedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        });

        return {
          ...source,
          totalIncidents: incidentCount,
          recentIncidents: recentCount,
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
 *
 * Get details for a specific source
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const source = await prisma.source.findUnique({
      where: { id },
    });

    if (!source) {
      res.status(404).json({ error: 'Source not found' });
      return;
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
