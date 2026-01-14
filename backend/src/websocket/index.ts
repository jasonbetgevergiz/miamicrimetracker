/**
 * WebSocket Server Implementation
 * Real-time updates via Socket.IO
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../lib/logger';

/**
 * Track client subscriptions
 */
const clientSubscriptions = new Map<
  string,
  {
    incidents: boolean;
    transit: boolean;
    stats: boolean;
  }
>();

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(io: SocketIOServer): void {
  logger.info('Initializing WebSocket server');

  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Initialize subscriptions
    clientSubscriptions.set(socket.id, {
      incidents: false,
      transit: false,
      stats: false,
    });

    // Subscribe to incidents
    socket.on('subscribe:incidents', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) {
        subs.incidents = true;
        logger.debug('Client subscribed to incidents', { socketId: socket.id });
      }
      socket.emit('subscribed:incidents');
    });

    // Subscribe to transit
    socket.on('subscribe:transit', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) {
        subs.transit = true;
        logger.debug('Client subscribed to transit', { socketId: socket.id });
      }
      socket.emit('subscribed:transit');
    });

    // Subscribe to stats
    socket.on('subscribe:stats', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) {
        subs.stats = true;
        logger.debug('Client subscribed to stats', { socketId: socket.id });
      }
      socket.emit('subscribed:stats');
    });

    // Unsubscribe handlers
    socket.on('unsubscribe:incidents', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) subs.incidents = false;
    });

    socket.on('unsubscribe:transit', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) subs.transit = false;
    });

    socket.on('unsubscribe:stats', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) subs.stats = false;
    });

    // Ping/Pong
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', { socketId: socket.id, reason });
      clientSubscriptions.delete(socket.id);
    });
  });

  // Store io globally
  global.io = io;
}

/**
 * Broadcast new incident
 */
export function broadcastIncidentNew(incident: any): void {
  if (global.io) {
    global.io.emit('incident:new', incident);
    logger.debug('Broadcasted new incident', { id: incident.id });
  }
}

/**
 * Broadcast incident update
 */
export function broadcastIncidentUpdate(incident: any): void {
  if (global.io) {
    global.io.emit('incident:update', incident);
    logger.debug('Broadcasted incident update', { id: incident.id });
  }
}

/**
 * Broadcast incident resolved
 */
export function broadcastIncidentResolved(incident: any): void {
  if (global.io) {
    global.io.emit('incident:resolved', incident);
    logger.debug('Broadcasted incident resolved', { id: incident.id });
  }
}

/**
 * Broadcast transit updates
 */
export function broadcastTransitUpdate(vehicles: any[]): void {
  if (global.io) {
    global.io.emit('transit:update', {
      vehicles,
      timestamp: new Date().toISOString(),
    });
    logger.debug('Broadcasted transit update', { count: vehicles.length });
  }
}

/**
 * Broadcast stats update
 */
export function broadcastStatsUpdate(stats: any): void {
  if (global.io) {
    global.io.emit('stats:update', stats);
    logger.debug('Broadcasted stats update');
  }
}

/**
 * Get connection count
 */
export function getConnectionCount(): number {
  return global.io ? global.io.sockets.sockets.size : 0;
}

// Type declaration
declare global {
  var io: SocketIOServer | undefined;
}
