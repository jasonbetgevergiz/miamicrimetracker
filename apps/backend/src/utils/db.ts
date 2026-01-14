/**
 * Prisma database client singleton
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

/**
 * Global Prisma client instance with logging
 */
export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug('Query:', {
      query: e.query,
      duration: `${e.duration}ms`,
    });
  });
}

prisma.$on('error' as never, (e: any) => {
  logger.error('Database error:', e);
});

prisma.$on('warn' as never, (e: any) => {
  logger.warn('Database warning:', e);
});

/**
 * Connect to database and handle errors
 */
export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('✓ Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await disconnectDatabase();
});

export default prisma;
