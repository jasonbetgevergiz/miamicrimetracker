/**
 * Miami Crime Tracker - Backend Server
 * Express + Socket.IO + BullMQ
 */

import express, { Application, Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { logger } from './lib/logger';
import { connectDatabase, checkDatabaseHealth } from './lib/prisma';
import { checkRedisHealth } from './lib/redis';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Routes
import incidentsRouter from './routes/incidents';
import transitRouter from './routes/transit';
import statsRouter from './routes/stats';
import sourcesRouter from './routes/sources';

// Services
import { initializeWebSocket } from './websocket';
import { startBackgroundJobs, stopBackgroundJobs } from './jobs';

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Create and configure Express application
 */
function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: NODE_ENV === 'production',
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: CORS_ORIGIN.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(requestLogger);

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();
    const redisHealth = await checkRedisHealth();

    const isHealthy = dbHealth && redisHealth;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      checks: {
        database: dbHealth ? 'ok' : 'error',
        redis: redisHealth ? 'ok' : 'error',
      },
    });
  });

  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'Miami Crime Tracker API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        incidents: '/api/incidents',
        transit: '/api/transit',
        stats: '/api/stats',
        sources: '/api/sources',
        health: '/health',
      },
      documentation: '/docs',
    });
  });

  // API routes
  app.use('/api/incidents', incidentsRouter);
  app.use('/api/transit', transitRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/sources', sourcesRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
async function startServer() {
  try {
    logger.info('🚀 Starting Miami Crime Tracker Backend...');

    // Connect to database
    await connectDatabase();

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: CORS_ORIGIN.split(','),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Set up WebSocket handlers
    initializeWebSocket(io);

    // Start background jobs
    await startBackgroundJobs(io);

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`✓ Server running on port ${PORT}`);
      logger.info(`✓ Environment: ${NODE_ENV}`);
      logger.info(`✓ CORS enabled for: ${CORS_ORIGIN}`);
      logger.info(`✓ WebSocket server initialized`);
      logger.info(`✓ Background jobs started`);
      logger.info(`\n🌐 Ready to accept connections`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received, shutting down gracefully...`);

      // Stop accepting new connections
      httpServer.close(async () => {
        logger.info('HTTP server closed');

        // Stop background jobs
        await stopBackgroundJobs();

        // Close database connection
        const { disconnectDatabase } = await import('./lib/prisma');
        await disconnectDatabase();

        logger.info('✓ Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
