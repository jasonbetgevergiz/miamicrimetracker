/**
 * Background Jobs System (BullMQ)
 * Manages data ingestion and processing
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { Server as SocketIOServer } from 'socket.io';
import { redisConnection } from '../lib/redis';
import { logger } from '../lib/logger';

// Job processors
import { processIncidentFetch } from './fetchIncidents';
import { processTransitFetch } from './fetchTransit';
import { processStatsCalculation } from './calculateStats';
import { processCleanup } from './cleanup';

/**
 * Define queues
 */
export const dataIngestionQueue = new Queue('data-ingestion', {
  connection: redisConnection,
});

export const transitIngestionQueue = new Queue('transit-ingestion', {
  connection: redisConnection,
});

export const statsProcessingQueue = new Queue('stats-processing', {
  connection: redisConnection,
});

export const maintenanceQueue = new Queue('maintenance', {
  connection: redisConnection,
});

/**
 * Start all background jobs
 */
export async function startBackgroundJobs(io: SocketIOServer): Promise<void> {
  logger.info('Starting background jobs...');

  try {
    // Test Redis connection
    await redisConnection.ping();
    logger.info('✓ Redis connection verified for BullMQ');

    // Create workers
    createDataIngestionWorker(io);
    createTransitIngestionWorker(io);
    createStatsProcessingWorker(io);
    createMaintenanceWorker();

    // Schedule repeating jobs
    await scheduleRepeatingJobs();

    // Setup event listeners
    setupQueueEventListeners();

    logger.info('✓ Background jobs started successfully');
  } catch (error) {
    logger.error('Failed to start background jobs:', error);
    throw error;
  }
}

/**
 * Stop all background jobs
 */
export async function stopBackgroundJobs(): Promise<void> {
  logger.info('Stopping background jobs...');

  await dataIngestionQueue.close();
  await transitIngestionQueue.close();
  await statsProcessingQueue.close();
  await maintenanceQueue.close();

  logger.info('✓ Background jobs stopped');
}

/**
 * Create data ingestion worker
 */
function createDataIngestionWorker(io: SocketIOServer): void {
  const worker = new Worker(
    'data-ingestion',
    async (job) => {
      logger.debug('Processing data ingestion job', { jobId: job.id });
      return await processIncidentFetch(job.data, io);
    },
    {
      connection: redisConnection,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    logger.debug('Data ingestion job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Data ingestion job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });
}

/**
 * Create transit ingestion worker
 */
function createTransitIngestionWorker(io: SocketIOServer): void {
  const worker = new Worker(
    'transit-ingestion',
    async (job) => {
      logger.debug('Processing transit ingestion job', { jobId: job.id });
      return await processTransitFetch(job.data, io);
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    logger.debug('Transit ingestion job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Transit ingestion job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });
}

/**
 * Create stats processing worker
 */
function createStatsProcessingWorker(io: SocketIOServer): void {
  const worker = new Worker(
    'stats-processing',
    async (job) => {
      logger.debug('Processing stats calculation job', { jobId: job.id });
      return await processStatsCalculation(job.data, io);
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    logger.debug('Stats processing job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Stats processing job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });
}

/**
 * Create maintenance worker
 */
function createMaintenanceWorker(): void {
  const worker = new Worker(
    'maintenance',
    async (job) => {
      logger.debug('Processing maintenance job', { jobId: job.id });
      return await processCleanup(job.data);
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    logger.debug('Maintenance job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Maintenance job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });
}

/**
 * Schedule repeating jobs
 */
async function scheduleRepeatingJobs(): Promise<void> {
  // Fetch incidents every 30 seconds
  await dataIngestionQueue.add(
    'fetch-incidents',
    { source: 'miami-pd' },
    {
      repeat: {
        every: 30000, // 30 seconds
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  // Fetch transit every 15 seconds
  await transitIngestionQueue.add(
    'fetch-transit',
    {},
    {
      repeat: {
        every: 15000, // 15 seconds
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  // Calculate stats every 60 seconds
  await statsProcessingQueue.add(
    'calculate-stats',
    {},
    {
      repeat: {
        every: 60000, // 60 seconds
      },
      removeOnComplete: 50,
      removeOnFail: 25,
    }
  );

  // Cleanup every 5 minutes
  await maintenanceQueue.add(
    'cleanup',
    {},
    {
      repeat: {
        every: 300000, // 5 minutes
      },
      removeOnComplete: 10,
      removeOnFail: 10,
    }
  );

  logger.info('✓ Repeating jobs scheduled');
}

/**
 * Setup queue event listeners
 */
function setupQueueEventListeners(): void {
  const queues = [
    dataIngestionQueue,
    transitIngestionQueue,
    statsProcessingQueue,
    maintenanceQueue,
  ];

  queues.forEach((queue) => {
    const queueEvents = new QueueEvents(queue.name, {
      connection: redisConnection,
    });

    queueEvents.on('error', (err) => {
      logger.error(`Queue ${queue.name} error:`, err);
    });
  });
}
