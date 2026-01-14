/**
 * Transit API Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * Query schema for transit vehicles
 */
const transitQuerySchema = z.object({
  type: z.enum(['bus', 'metrorail', 'metromover']).optional(),
  route: z.string().optional(),
  bounds: z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/).optional(),
  status: z.enum(['active', 'delayed', 'offline']).optional(),
});

/**
 * GET /api/transit/live
 * Get live transit vehicle locations
 */
router.get(
  '/live',
  asyncHandler(async (req, res) => {
    const query = transitQuerySchema.parse(req.query);

    const where: any = {};

    if (query.type) where.vehicleType = query.type;
    if (query.route) where.routeId = query.route;
    if (query.status) where.status = query.status;

    // Geographic bounds
    if (query.bounds) {
      const [swLat, swLng, neLat, neLng] = query.bounds.split(',').map(Number);
      where.AND = [
        { latitude: { gte: swLat, lte: neLat } },
        { longitude: { gte: swLng, lte: neLng } },
      ];
    }

    // Only show vehicles updated in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    where.lastUpdate = { gte: fiveMinutesAgo };

    const vehicles = await prisma.transitVehicle.findMany({
      where,
      orderBy: { lastUpdate: 'desc' },
    });

    const totalCount = await prisma.transitVehicle.count({
      where: { lastUpdate: { gte: fiveMinutesAgo } },
    });

    res.json({
      data: vehicles,
      meta: {
        totalVehicles: totalCount,
        activeVehicles: vehicles.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/transit/routes
 * Get list of all routes with vehicle counts
 */
router.get(
  '/routes',
  asyncHandler(async (req, res) => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const vehicles = await prisma.transitVehicle.findMany({
      where: { lastUpdate: { gte: fiveMinutesAgo } },
      select: {
        routeId: true,
        routeName: true,
        vehicleType: true,
      },
    });

    // Group by route
    const routeMap = new Map<
      string,
      { routeId: string; routeName: string; vehicleType: string; count: number }
    >();

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
 * Get specific vehicle details
 */
router.get(
  '/:vehicleId',
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;

    const vehicle = await prisma.transitVehicle.findUnique({
      where: { vehicleId },
    });

    if (!vehicle) {
      throw new AppError(404, 'Vehicle not found');
    }

    res.json(vehicle);
  })
);

export default router;
