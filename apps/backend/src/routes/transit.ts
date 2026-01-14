/**
 * Transit API Routes
 *
 * Provides real-time location data for Miami-Dade transit vehicles
 * including buses, metrorail, and metromover.
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
const transitQuerySchema = z.object({
  type: z.enum(['bus', 'metrorail', 'metromover']).optional(),
  route: z.string().optional(),
  bounds: z.string().optional(), // Format: "swLat,swLng,neLat,neLng"
  status: z.enum(['active', 'delayed', 'offline']).optional(),
});

/**
 * GET /api/transit/live
 *
 * Retrieve live transit vehicle locations
 *
 * Query Parameters:
 * - type: Filter by vehicle type (bus, metrorail, metromover)
 * - route: Filter by route ID
 * - bounds: Map bounds "swLat,swLng,neLat,neLng"
 * - status: Filter by vehicle status
 *
 * Response:
 * - data: Array of transit vehicle objects
 * - meta: Metadata including total count and fetch time
 */
router.get(
  '/live',
  asyncHandler(async (req: Request, res: Response) => {
    // Validate query parameters
    const query = transitQuerySchema.parse(req.query);

    // Build filter conditions
    const where: any = {};

    if (query.type) {
      where.vehicleType = query.type;
    }

    if (query.route) {
      where.routeId = query.route;
    }

    if (query.status) {
      where.status = query.status;
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

    // Only return vehicles updated in last 5 minutes (consider them active)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    where.lastUpdate = {
      gte: fiveMinutesAgo,
    };

    // Execute query
    const vehicles = await prisma.transitVehicle.findMany({
      where,
      orderBy: {
        lastUpdate: 'desc',
      },
    });

    // Get total count
    const totalCount = await prisma.transitVehicle.count({
      where: {
        lastUpdate: {
          gte: fiveMinutesAgo,
        },
      },
    });

    // Return response
    res.json({
      data: vehicles,
      meta: {
        totalVehicles: totalCount,
        activeVehicles: vehicles.length,
        fetchedAt: new Date().toISOString(),
      },
    });

    logger.debug('Transit query', {
      filters: where,
      count: vehicles.length,
    });
  })
);

/**
 * GET /api/transit/routes
 *
 * Get list of all available routes with vehicle counts
 *
 * Response:
 * - data: Array of route objects with counts
 */
router.get(
  '/routes',
  asyncHandler(async (req: Request, res: Response) => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Get all vehicles updated in last 5 minutes
    const vehicles = await prisma.transitVehicle.findMany({
      where: {
        lastUpdate: {
          gte: fiveMinutesAgo,
        },
      },
      select: {
        routeId: true,
        routeName: true,
        vehicleType: true,
      },
    });

    // Group by route
    const routeMap = new Map<string, {
      routeId: string;
      routeName: string;
      vehicleType: string;
      count: number;
    }>();

    vehicles.forEach((vehicle) => {
      const key = vehicle.routeId;
      if (routeMap.has(key)) {
        routeMap.get(key)!.count++;
      } else {
        routeMap.set(key, {
          routeId: vehicle.routeId,
          routeName: vehicle.routeName,
          vehicleType: vehicle.vehicleType,
          count: 1,
        });
      }
    });

    const routes = Array.from(routeMap.values()).sort((a, b) =>
      a.routeName.localeCompare(b.routeName)
    );

    res.json({
      data: routes,
      meta: {
        totalRoutes: routes.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/transit/:vehicleId
 *
 * Get details for a specific vehicle
 *
 * Parameters:
 * - vehicleId: Vehicle identifier
 *
 * Response:
 * - Single vehicle object
 */
router.get(
  '/:vehicleId',
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId } = req.params;

    const vehicle = await prisma.transitVehicle.findUnique({
      where: { vehicleId },
    });

    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    res.json(vehicle);
  })
);

export default router;
