/**
 * Miami Crime Tracker - Backend API Server
 *
 * Main server file that sets up Express, Socket.IO, and all middleware.
 * Provides REST APIs and WebSocket connections for real-time updates.
 */

import express, { Application } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes
import incidentsRouter from './routes/incidents';
import transitRouter from './routes/transit';
import statsRouter from './routes/stats';
import sourcesRouter from './routes/sources';

// Import services
import { initializeWebSocket } from './websocket';
import { startBackgroundJobs } from './jobs';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';

/**
 * Initialize and configure the Express application
 */
function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression middleware
  app.use(compression());

  // Request logging
  app.use(requestLogger);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API routes
  app.use('/api/incidents', incidentsRouter);
  app.use('/api/transit', transitRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/sources', sourcesRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the server and initialize all services
 */
async function startServer() {
  try {
    // Create Express app
    const app = createApp();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: CORS_ORIGIN,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Set up WebSocket handlers
    initializeWebSocket(io);

    // Start background jobs (BullMQ)
    await startBackgroundJobs(io);

    // Start listening
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 CORS enabled for: ${CORS_ORIGIN}`);
      logger.info(`💬 WebSocket server initialized`);
      logger.info(`⚡ Background jobs started`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
