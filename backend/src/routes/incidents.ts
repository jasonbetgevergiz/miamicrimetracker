/**
 * Incidents API Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../lib/logger';

const router = Router();

/**
 * Query schema for listing incidents
 */
const incidentQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  type: z.enum(['crime', 'accident', 'fire', 'emergency']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['active', 'resolved', 'monitoring']).optional(),
  search: z.string().optional(),
  source: z.string().optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  bounds: z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/).optional(),
});

/**
 * GET /api/incidents
 * List incidents with filtering and pagination
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = incidentQuerySchema.parse(req.query);

    // Build where clause
    const where: any = {};

    if (query.type) where.type = query.type;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;

    // Keyword search
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Source filter
    if (query.source) {
      where.source = { name: query.source };
    }

    // Date range
    if (query.since || query.until) {
      where.reportedAt = {};
      if (query.since) where.reportedAt.gte = new Date(query.since);
      if (query.until) where.reportedAt.lte = new Date(query.until);
    }

    // Geographic bounds
    if (query.bounds) {
      const [swLat, swLng, neLat, neLng] = query.bounds.split(',').map(Number);
      where.AND = [
        { latitude: { gte: swLat, lte: neLat } },
        { longitude: { gte: swLng, lte: neLng } },
      ];
    }

    // Execute query
    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        include: {
          source: {
            select: { name: true, type: true },
          },
        },
        orderBy: { reportedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.incident.count({ where }),
    ]);

    res.json({
      data: incidents,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total,
      },
      meta: {
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/incidents/:id
 * Get single incident by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: { source: true },
    });

    if (!incident) {
      throw new AppError(404, 'Incident not found');
    }

    res.json(incident);
  })
);

/**
 * POST /api/incidents
 * Create new incident (requires API key)
 */
const createIncidentSchema = z.object({
  externalId: z.string().optional(),
  type: z.enum(['crime', 'accident', 'fire', 'emergency']),
  category: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['active', 'resolved', 'monitoring']).default('active'),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional(),
  reportedAt: z.string().datetime(),
  sourceId: z.string(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    // Check API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
      throw new AppError(401, 'Unauthorized: Invalid API key');
    }

    const data = createIncidentSchema.parse(req.body);

    const incident = await prisma.incident.create({
      data: {
        ...data,
        reportedAt: new Date(data.reportedAt),
      },
      include: { source: true },
    });

    logger.info('Incident created', { id: incident.id, type: incident.type });

    res.status(201).json(incident);
  })
);

/**
 * PATCH /api/incidents/:id
 * Update incident (requires API key)
 */
const updateIncidentSchema = z.object({
  status: z.enum(['active', 'resolved', 'monitoring']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  description: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
      throw new AppError(401, 'Unauthorized: Invalid API key');
    }

    const { id } = req.params;
    const data = updateIncidentSchema.parse(req.body);

    const incident = await prisma.incident.update({
      where: { id },
      data: {
        ...data,
        ...(data.resolvedAt && { resolvedAt: new Date(data.resolvedAt) }),
      },
      include: { source: true },
    });

    logger.info('Incident updated', { id, status: incident.status });

    res.json(incident);
  })
);

export default router;
