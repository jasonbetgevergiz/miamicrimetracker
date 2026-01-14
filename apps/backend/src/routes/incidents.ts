/**
 * Incidents API Routes
 *
 * Provides endpoints for querying and managing crime/incident data
 * with comprehensive filtering, pagination, and search capabilities.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Query parameter validation schema
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
  bounds: z.string().optional(), // Format: "swLat,swLng,neLat,neLng"
});

/**
 * GET /api/incidents
 *
 * Retrieve incidents with optional filtering and pagination
 *
 * Query Parameters:
 * - limit: Number of results (1-200, default: 50)
 * - offset: Pagination offset (default: 0)
 * - type: Filter by incident type
 * - severity: Filter by severity level
 * - status: Filter by incident status
 * - search: Keyword search in title/description
 * - source: Filter by source name
 * - since: ISO datetime - incidents after this time
 * - until: ISO datetime - incidents before this time
 * - bounds: Map bounds "swLat,swLng,neLat,neLng"
 *
 * Response:
 * - data: Array of incident objects
 * - pagination: Pagination metadata
 * - meta: Additional metadata
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    // Validate query parameters
    const query = incidentQuerySchema.parse(req.query);

    // Build filter conditions
    const where: any = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.source) {
      where.source = {
        name: query.source,
      };
    }

    // Date range filter
    if (query.since || query.until) {
      where.reportedAt = {};
      if (query.since) {
        where.reportedAt.gte = new Date(query.since);
      }
      if (query.until) {
        where.reportedAt.lte = new Date(query.until);
      }
    }

    // Geographic bounds filter
    if (query.bounds) {
      const [swLat, swLng, neLat, neLng] = query.bounds.split(',').map(Number);
      if (swLat && swLng && neLat && neLng) {
        where.AND = [
          { latitude: { gte: swLat, lte: neLat } },
          { longitude: { gte: swLng, lte: neLng } },
        ];
      }
    }

    // Execute query with pagination
    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        include: {
          source: {
            select: {
              name: true,
              type: true,
            },
          },
        },
        orderBy: {
          reportedAt: 'desc',
        },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.incident.count({ where }),
    ]);

    // Return response
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

    logger.debug('Incidents query', {
      filters: where,
      count: incidents.length,
      total,
    });
  })
);

/**
 * GET /api/incidents/:id
 *
 * Retrieve a single incident by ID
 *
 * Parameters:
 * - id: Incident ID (CUID)
 *
 * Response:
 * - Single incident object with full details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        source: true,
      },
    });

    if (!incident) {
      throw new AppError(404, 'Incident not found');
    }

    res.json(incident);
  })
);

/**
 * POST /api/incidents
 *
 * Create a new incident (for internal use or webhooks)
 * Requires API key authentication
 *
 * Body:
 * - All incident fields as per schema
 *
 * Response:
 * - Created incident object
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
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).default([]),
});

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    // Check API key (simple auth for now)
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
      throw new AppError(401, 'Unauthorized');
    }

    // Validate request body
    const data = createIncidentSchema.parse(req.body);

    // Create incident
    const incident = await prisma.incident.create({
      data: {
        ...data,
        reportedAt: new Date(data.reportedAt),
      },
      include: {
        source: true,
      },
    });

    logger.info('Incident created', { id: incident.id, type: incident.type });

    res.status(201).json(incident);
  })
);

/**
 * PATCH /api/incidents/:id
 *
 * Update an incident (e.g., mark as resolved)
 * Requires API key authentication
 */
const updateIncidentSchema = z.object({
  status: z.enum(['active', 'resolved', 'monitoring']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  description: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
});

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
      throw new AppError(401, 'Unauthorized');
    }

    const { id } = req.params;
    const data = updateIncidentSchema.parse(req.body);

    const incident = await prisma.incident.update({
      where: { id },
      data: {
        ...data,
        ...(data.resolvedAt && { resolvedAt: new Date(data.resolvedAt) }),
      },
      include: {
        source: true,
      },
    });

    logger.info('Incident updated', { id, status: incident.status });

    res.json(incident);
  })
);

export default router;
