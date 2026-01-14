/**
 * WebSocket Server Implementation
 *
 * Handles real-time communication with clients
 * Broadcasts incident updates, transit updates, and stats changes
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';

/**
 * Map to track client subscriptions
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
 * Initialize WebSocket server and set up event handlers
 */
export function initializeWebSocket(io: SocketIOServer): void {
  logger.info('Initializing WebSocket server');

  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Initialize subscriptions for this client
    clientSubscriptions.set(socket.id, {
      incidents: false,
      transit: false,
      stats: false,
    });

    // Handle subscription requests
    socket.on('subscribe:incidents', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) {
        subs.incidents = true;
        logger.debug('Client subscribed to incidents', { socketId: socket.id });
      }
      socket.emit('subscribed:incidents');
    });

    socket.on('subscribe:transit', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) {
        subs.transit = true;
        logger.debug('Client subscribed to transit', { socketId: socket.id });
      }
      socket.emit('subscribed:transit');
    });

    socket.on('subscribe:stats', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) {
        subs.stats = true;
        logger.debug('Client subscribed to stats', { socketId: socket.id });
      }
      socket.emit('subscribed:stats');
    });

    // Handle unsubscribe requests
    socket.on('unsubscribe:incidents', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) {
        subs.incidents = false;
        logger.debug('Client unsubscribed from incidents', {
          socketId: socket.id,
        });
      }
    });

    socket.on('unsubscribe:transit', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) {
        subs.transit = false;
        logger.debug('Client unsubscribed from transit', {
          socketId: socket.id,
        });
      }
    });

    socket.on('unsubscribe:stats', () => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs) {
        subs.stats = false;
        logger.debug('Client unsubscribed from stats', { socketId: socket.id });
      }
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', {
        socketId: socket.id,
        reason,
      });
      clientSubscriptions.delete(socket.id);
    });
  });

  // Store io instance globally for use in other modules
  global.io = io;
}

/**
 * Broadcast a new incident to all subscribed clients
 */
export function broadcastIncidentNew(incident: any): void {
  if (global.io) {
    global.io.emit('incident:new', incident);
    logger.debug('Broadcasted new incident', { id: incident.id });
  }
}

/**
 * Broadcast an incident update to all subscribed clients
 */
export function broadcastIncidentUpdate(incident: any): void {
  if (global.io) {
    global.io.emit('incident:update', incident);
    logger.debug('Broadcasted incident update', { id: incident.id });
  }
}

/**
 * Broadcast when an incident is resolved
 */
export function broadcastIncidentResolved(incident: any): void {
  if (global.io) {
    global.io.emit('incident:resolved', incident);
    logger.debug('Broadcasted incident resolved', { id: incident.id });
  }
}

/**
 * Broadcast bulk transit vehicle updates
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
 * Broadcast dashboard stats update
 */
export function broadcastStatsUpdate(stats: any): void {
  if (global.io) {
    global.io.emit('stats:update', stats);
    logger.debug('Broadcasted stats update');
  }
}

/**
 * Get current connection count
 */
export function getConnectionCount(): number {
  return global.io ? global.io.sockets.sockets.size : 0;
}

// Extend global namespace for io instance
declare global {
  var io: SocketIOServer | undefined;
}
