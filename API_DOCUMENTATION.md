# Miami Crime Tracker API Documentation

**Version:** 1.0.0
**Base URL:** `http://localhost:3000` (Development) | `https://api.miamicrime.app` (Production)
**Protocol:** REST API + WebSocket
**Last Updated:** 2026-01-14

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Error Handling](#error-handling)
5. [Data Models](#data-models)
6. [REST API Endpoints](#rest-api-endpoints)
   - [Incidents API](#incidents-api)
   - [Transit API](#transit-api)
   - [Statistics API](#statistics-api)
   - [Sources API](#sources-api)
7. [WebSocket API](#websocket-api)
8. [Code Examples](#code-examples)
9. [Changelog](#changelog)

---

## Overview

The Miami Crime Tracker API provides real-time access to crime incidents, emergency events, and public transit data for the Miami-Dade area. The API supports both HTTP REST endpoints for querying data and WebSocket connections for receiving real-time updates.

### Key Features

- **Real-time Data**: Automatic updates every 15-30 seconds
- **Comprehensive Filtering**: Filter by type, severity, location, time range, and more
- **Geographic Queries**: Bounding box filtering for map-based applications
- **Aggregated Statistics**: Pre-calculated dashboard metrics
- **WebSocket Support**: Push notifications for new incidents and updates
- **Type Safety**: Full TypeScript support

### Base URLs

| Environment | REST API | WebSocket |
|------------|----------|-----------|
| Development | `http://localhost:3000` | `ws://localhost:3000` |
| Production | `https://api.miamicrime.app` | `wss://api.miamicrime.app` |

---

## Authentication

### Public Endpoints (No Auth Required)

The following endpoints are publicly accessible:

- `GET /health`
- `GET /api/incidents`
- `GET /api/incidents/:id`
- `GET /api/transit/live`
- `GET /api/transit/routes`
- `GET /api/transit/:vehicleId`
- `GET /api/stats/*`
- `GET /api/sources`
- WebSocket connections

### Protected Endpoints (API Key Required)

The following endpoints require an API key:

- `POST /api/incidents`
- `PATCH /api/incidents/:id`

#### Using API Keys

Include your API key in the `X-API-Key` header:

```http
X-API-Key: your-api-key-here
```

**Example:**

```bash
curl -X POST https://api.miamicrime.app/api/incidents \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"type": "crime", ...}'
```

---

## Rate Limiting

### Default Limits

| Endpoint Category | Requests per Minute |
|------------------|-------------------|
| Read Operations (GET) | 100 |
| Write Operations (POST/PATCH) | 20 |
| WebSocket Connections | 10 per IP |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706112000
```

### Exceeding Limits

When rate limits are exceeded, the API returns:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again in 60 seconds.",
  "retryAfter": 60
}
```

**Status Code:** `429 Too Many Requests`

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error description",
  "details": {
    "field": "Additional context (optional)"
  }
}
```

### HTTP Status Codes

| Code | Description | When It Occurs |
|------|------------|---------------|
| `200` | OK | Successful request |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Missing or invalid API key |
| `404` | Not Found | Resource not found |
| `422` | Unprocessable Entity | Validation error |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |
| `503` | Service Unavailable | Service temporarily down |

### Common Error Examples

#### 400 Bad Request

```json
{
  "error": "Validation Error",
  "message": "Invalid query parameters",
  "details": {
    "severity": "Must be one of: low, medium, high, critical"
  }
}
```

#### 404 Not Found

```json
{
  "error": "Not Found",
  "message": "Incident not found",
  "details": {
    "id": "clx123456789"
  }
}
```

---

## Data Models

### Incident

Represents a crime or emergency incident.

```typescript
interface Incident {
  id: string;                    // Unique identifier (CUID)
  externalId?: string;           // External source ID

  // Classification
  type: 'crime' | 'accident' | 'fire' | 'emergency';
  category: string;              // Specific category (e.g., "robbery")
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'monitoring';

  // Description
  title: string;                 // Brief title
  description?: string;          // Detailed description

  // Location
  location: string;              // Area name (e.g., "Downtown Miami")
  latitude: number;              // Decimal degrees
  longitude: number;             // Decimal degrees
  address?: string;              // Street address

  // Timestamps
  reportedAt: string;            // ISO 8601 datetime
  resolvedAt?: string;           // ISO 8601 datetime (if resolved)
  createdAt: string;             // ISO 8601 datetime
  updatedAt: string;             // ISO 8601 datetime

  // Metadata
  source: Source;                // Data source information
  tags: string[];                // Searchable tags
  metadata?: Record<string, any>; // Additional flexible data
}
```

**Example:**

```json
{
  "id": "clx7j2k3m0001",
  "externalId": "MPD-2026-00123",
  "type": "crime",
  "category": "robbery",
  "severity": "high",
  "status": "active",
  "title": "Armed Robbery at Convenience Store",
  "description": "Two suspects entered the store with weapons and demanded cash. Suspects fled on foot. No injuries reported.",
  "location": "Downtown Miami",
  "latitude": 25.7617,
  "longitude": -80.1918,
  "address": "123 Biscayne Blvd",
  "reportedAt": "2026-01-14T14:30:00Z",
  "createdAt": "2026-01-14T14:31:15Z",
  "updatedAt": "2026-01-14T14:31:15Z",
  "source": {
    "name": "Miami PD",
    "type": "official"
  },
  "tags": ["armed", "commercial", "priority"]
}
```

### Transit Vehicle

Represents a public transit vehicle location.

```typescript
interface TransitVehicle {
  id: string;                    // Database ID (CUID)
  vehicleId: string;             // Vehicle identifier

  // Route Information
  routeId: string;               // Route number/ID
  routeName: string;             // Human-readable route name
  vehicleType: 'bus' | 'metrorail' | 'metromover';

  // Location
  latitude: number;              // Decimal degrees
  longitude: number;             // Decimal degrees
  heading?: number;              // Direction (0-359 degrees)
  speed?: number;                // Speed in mph

  // Status
  status: 'active' | 'delayed' | 'offline';
  occupancy?: 'empty' | 'low' | 'medium' | 'high' | 'full';

  // Timestamps
  lastUpdate: string;            // ISO 8601 datetime
  createdAt: string;             // ISO 8601 datetime
  updatedAt: string;             // ISO 8601 datetime
}
```

**Example:**

```json
{
  "id": "clx7j2k3m0002",
  "vehicleId": "BUS-1234",
  "routeId": "95",
  "routeName": "95 - Biscayne Express",
  "vehicleType": "bus",
  "latitude": 25.7907,
  "longitude": -80.1300,
  "heading": 180,
  "speed": 25.5,
  "status": "active",
  "occupancy": "medium",
  "lastUpdate": "2026-01-14T15:00:12Z",
  "createdAt": "2026-01-14T10:00:00Z",
  "updatedAt": "2026-01-14T15:00:12Z"
}
```

### Source

Represents a data source for incidents.

```typescript
interface Source {
  id: string;                    // Unique identifier
  name: string;                  // Source name
  type: 'official' | 'news' | 'social' | 'emergency';
  url?: string;                  // Source website
  apiEndpoint?: string;          // API endpoint (internal)
  isActive: boolean;             // Whether source is active
  lastFetchAt?: string;          // ISO 8601 datetime
  fetchInterval: number;         // Fetch interval in seconds
  createdAt: string;             // ISO 8601 datetime
  updatedAt: string;             // ISO 8601 datetime
}
```

---

## REST API Endpoints

### Incidents API

#### GET /api/incidents

Retrieve a paginated list of incidents with optional filtering.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 50 | Number of results (1-200) |
| `offset` | number | No | 0 | Pagination offset |
| `type` | string | No | - | Filter by type: `crime`, `accident`, `fire`, `emergency` |
| `severity` | string | No | - | Filter by severity: `low`, `medium`, `high`, `critical` |
| `status` | string | No | - | Filter by status: `active`, `resolved`, `monitoring` |
| `search` | string | No | - | Keyword search in title/description/location |
| `source` | string | No | - | Filter by source name |
| `since` | string (ISO 8601) | No | - | Incidents after this datetime |
| `until` | string (ISO 8601) | No | - | Incidents before this datetime |
| `bounds` | string | No | - | Map bounds: `swLat,swLng,neLat,neLng` |

**Example Request:**

```bash
curl "https://api.miamicrime.app/api/incidents?severity=high&limit=10"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "clx7j2k3m0001",
      "type": "crime",
      "category": "robbery",
      "severity": "high",
      "status": "active",
      "title": "Armed Robbery at Convenience Store",
      "location": "Downtown Miami",
      "latitude": 25.7617,
      "longitude": -80.1918,
      "reportedAt": "2026-01-14T14:30:00Z",
      "source": {
        "name": "Miami PD",
        "type": "official"
      }
    }
  ],
  "pagination": {
    "total": 87,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  },
  "meta": {
    "fetchedAt": "2026-01-14T15:00:00Z"
  }
}
```

#### GET /api/incidents/:id

Retrieve a single incident by ID.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Incident ID (CUID) |

**Example Request:**

```bash
curl "https://api.miamicrime.app/api/incidents/clx7j2k3m0001"
```

**Example Response:**

```json
{
  "id": "clx7j2k3m0001",
  "externalId": "MPD-2026-00123",
  "type": "crime",
  "category": "robbery",
  "severity": "high",
  "status": "active",
  "title": "Armed Robbery at Convenience Store",
  "description": "Two suspects entered the store with weapons...",
  "location": "Downtown Miami",
  "latitude": 25.7617,
  "longitude": -80.1918,
  "address": "123 Biscayne Blvd",
  "reportedAt": "2026-01-14T14:30:00Z",
  "createdAt": "2026-01-14T14:31:15Z",
  "updatedAt": "2026-01-14T14:31:15Z",
  "source": {
    "id": "clx7j2k3m0010",
    "name": "Miami PD",
    "type": "official"
  },
  "tags": ["armed", "commercial"],
  "metadata": {}
}
```

#### POST /api/incidents

Create a new incident (requires API key).

**Authentication:** Required (API Key)

**Request Body:**

```typescript
{
  externalId?: string;
  type: 'crime' | 'accident' | 'fire' | 'emergency';
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status?: 'active' | 'resolved' | 'monitoring'; // default: 'active'
  title: string;
  description?: string;
  location: string;
  latitude: number;   // -90 to 90
  longitude: number;  // -180 to 180
  address?: string;
  reportedAt: string; // ISO 8601 datetime
  sourceId: string;
  tags?: string[];
  metadata?: Record<string, any>;
}
```

**Example Request:**

```bash
curl -X POST "https://api.miamicrime.app/api/incidents" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "crime",
    "category": "theft",
    "severity": "medium",
    "title": "Vehicle Theft",
    "location": "Brickell",
    "latitude": 25.7617,
    "longitude": -80.1918,
    "reportedAt": "2026-01-14T15:00:00Z",
    "sourceId": "clx7j2k3m0010"
  }'
```

**Example Response:**

```json
{
  "id": "clx7j2k3m0099",
  "type": "crime",
  "category": "theft",
  "severity": "medium",
  "status": "active",
  "title": "Vehicle Theft",
  "location": "Brickell",
  "latitude": 25.7617,
  "longitude": -80.1918,
  "reportedAt": "2026-01-14T15:00:00Z",
  "createdAt": "2026-01-14T15:01:00Z",
  "updatedAt": "2026-01-14T15:01:00Z",
  "source": {
    "name": "Miami PD",
    "type": "official"
  },
  "tags": []
}
```

#### PATCH /api/incidents/:id

Update an existing incident (requires API key).

**Authentication:** Required (API Key)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Incident ID (CUID) |

**Request Body:**

```typescript
{
  status?: 'active' | 'resolved' | 'monitoring';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  resolvedAt?: string; // ISO 8601 datetime
}
```

**Example Request:**

```bash
curl -X PATCH "https://api.miamicrime.app/api/incidents/clx7j2k3m0001" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolvedAt": "2026-01-14T16:00:00Z"
  }'
```

---

### Transit API

#### GET /api/transit/live

Retrieve live transit vehicle locations.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | string | No | - | Filter by type: `bus`, `metrorail`, `metromover` |
| `route` | string | No | - | Filter by route ID |
| `bounds` | string | No | - | Map bounds: `swLat,swLng,neLat,neLng` |
| `status` | string | No | - | Filter by status: `active`, `delayed`, `offline` |

**Example Request:**

```bash
curl "https://api.miamicrime.app/api/transit/live?type=bus&route=95"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "clx7j2k3m0002",
      "vehicleId": "BUS-1234",
      "routeId": "95",
      "routeName": "95 - Biscayne Express",
      "vehicleType": "bus",
      "latitude": 25.7907,
      "longitude": -80.1300,
      "heading": 180,
      "speed": 25.5,
      "status": "active",
      "occupancy": "medium",
      "lastUpdate": "2026-01-14T15:00:12Z"
    }
  ],
  "meta": {
    "totalVehicles": 156,
    "activeVehicles": 145,
    "fetchedAt": "2026-01-14T15:00:15Z"
  }
}
```

#### GET /api/transit/routes

Get list of all available routes with vehicle counts.

**Example Request:**

```bash
curl "https://api.miamicrime.app/api/transit/routes"
```

**Example Response:**

```json
{
  "data": [
    {
      "routeId": "95",
      "routeName": "95 - Biscayne Express",
      "vehicleType": "bus",
      "count": 12
    },
    {
      "routeId": "RAIL-1",
      "routeName": "Orange Line",
      "vehicleType": "metrorail",
      "count": 8
    }
  ],
  "meta": {
    "totalRoutes": 45,
    "fetchedAt": "2026-01-14T15:00:15Z"
  }
}
```

#### GET /api/transit/:vehicleId

Get details for a specific vehicle.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vehicleId` | string | Yes | Vehicle identifier |

**Example Request:**

```bash
curl "https://api.miamicrime.app/api/transit/BUS-1234"
```

---

### Statistics API

#### GET /api/stats/dashboard

Get comprehensive dashboard statistics.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | string | No | `24h` | Time period: `24h`, `7d`, `30d` |

**Example Request:**

```bash
curl "https://api.miamicrime.app/api/stats/dashboard?period=24h"
```

**Example Response:**

```json
{
  "period": "24h",
  "summary": {
    "totalIncidents": 87,
    "criticalIncidents": 12,
    "activeIncidents": 34,
    "resolvedIncidents": 53
  },
  "byType": {
    "crime": 45,
    "accident": 23,
    "fire": 8,
    "emergency": 11
  },
  "bySeverity": {
    "low": 34,
    "medium": 32,
    "high": 15,
    "critical": 6
  },
  "trend": [
    {"time": "2026-01-14T00:00:00Z", "label": "12:00 AM", "count": 3},
    {"time": "2026-01-14T01:00:00Z", "label": "01:00 AM", "count": 1}
  ],
  "topLocations": [
    {"location": "Downtown Miami", "count": 12},
    {"location": "Little Havana", "count": 8}
  ],
  "recentSpikes": [
    {
      "time": "2026-01-14T13:00:00Z",
      "count": 8,
      "normal": 2,
      "deviation": "3.0"
    }
  ],
  "calculatedAt": "2026-01-14T15:00:00Z"
}
```

#### GET /api/stats/timeline

Get detailed timeline data for visualization.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | string | No | `24h` | Time period: `24h`, `7d` |
| `granularity` | string | No | `hourly` | Granularity: `hourly`, `daily` |

**Example Request:**

```bash
curl "https://api.miamicrime.app/api/stats/timeline?period=24h&granularity=hourly"
```

#### GET /api/stats/status

Get current system status (GREEN/YELLOW/RED).

**Example Request:**

```bash
curl "https://api.miamicrime.app/api/stats/status"
```

**Example Response:**

```json
{
  "status": "YELLOW",
  "reason": "Elevated incident activity detected",
  "metrics": {
    "criticalIncidentsLastHour": 4,
    "activeEmergencies": 1
  },
  "timestamp": "2026-01-14T15:00:00Z"
}
```

**Status Indicators:**

- **GREEN**: Normal operations (< 3 critical incidents/hour)
- **YELLOW**: Watch mode (3-5 critical incidents or unusual activity)
- **RED**: Critical mode (> 5 critical incidents or multiple emergencies)

---

### Sources API

#### GET /api/sources

Get list of all data sources and their status.

**Example Request:**

```bash
curl "https://api.miamicrime.app/api/sources"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "clx7j2k3m0010",
      "name": "Miami PD",
      "type": "official",
      "url": "https://www.miamigov.com/police",
      "isActive": true,
      "lastFetchAt": "2026-01-14T14:59:30Z",
      "fetchInterval": 30,
      "totalIncidents": 1234,
      "recentIncidents": 45
    }
  ],
  "meta": {
    "totalSources": 3,
    "activeSources": 3
  }
}
```

---

## WebSocket API

The WebSocket API provides real-time push notifications for incidents, transit updates, and statistics.

### Connection

**Endpoint:** `ws://localhost:3000` (Development) | `wss://api.miamicrime.app` (Production)

**Protocol:** Socket.IO

### Client Connection Example

```typescript
import { io } from 'socket.io-client';

const socket = io('https://api.miamicrime.app', {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

### Events from Client

#### subscribe:incidents

Subscribe to incident updates.

```typescript
socket.emit('subscribe:incidents');

// Confirmation
socket.on('subscribed:incidents', () => {
  console.log('Subscribed to incidents');
});
```

#### subscribe:transit

Subscribe to transit vehicle updates.

```typescript
socket.emit('subscribe:transit');

// Confirmation
socket.on('subscribed:transit', () => {
  console.log('Subscribed to transit');
});
```

#### subscribe:stats

Subscribe to statistics updates.

```typescript
socket.emit('subscribe:stats');

// Confirmation
socket.on('subscribed:stats', () => {
  console.log('Subscribed to stats');
});
```

#### unsubscribe:*

Unsubscribe from updates.

```typescript
socket.emit('unsubscribe:incidents');
socket.emit('unsubscribe:transit');
socket.emit('unsubscribe:stats');
```

#### ping

Health check ping.

```typescript
socket.emit('ping');

socket.on('pong', (data) => {
  console.log('Latency:', Date.now() - data.timestamp, 'ms');
});
```

### Events from Server

#### incident:new

Fired when a new incident is created.

```typescript
socket.on('incident:new', (incident: Incident) => {
  console.log('New incident:', incident);
});
```

**Payload:** Full `Incident` object

#### incident:update

Fired when an incident is updated.

```typescript
socket.on('incident:update', (incident: Incident) => {
  console.log('Incident updated:', incident);
});
```

**Payload:** Full `Incident` object

#### incident:resolved

Fired when an incident is marked as resolved.

```typescript
socket.on('incident:resolved', (incident: Incident) => {
  console.log('Incident resolved:', incident);
});
```

**Payload:** Full `Incident` object

#### transit:update

Fired every 15-30 seconds with bulk transit vehicle updates.

```typescript
socket.on('transit:update', (data: {
  vehicles: TransitVehicle[];
  timestamp: string;
}) => {
  console.log('Transit update:', data.vehicles.length, 'vehicles');
});
```

**Payload:**
```typescript
{
  vehicles: TransitVehicle[];
  timestamp: string; // ISO 8601
}
```

#### stats:update

Fired every 60 seconds when dashboard statistics are recalculated.

```typescript
socket.on('stats:update', (stats: DashboardStats) => {
  console.log('Stats updated:', stats);
});
```

**Payload:** Dashboard statistics object

### Complete React Example

```typescript
'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useRealtimeIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL!);

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket');
      newSocket.emit('subscribe:incidents');
    });

    newSocket.on('incident:new', (incident: Incident) => {
      setIncidents((prev) => [incident, ...prev]);
    });

    newSocket.on('incident:update', (incident: Incident) => {
      setIncidents((prev) =>
        prev.map((i) => (i.id === incident.id ? incident : i))
      );
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return { incidents, socket };
}
```

---

## Code Examples

### JavaScript/TypeScript

#### Fetch Recent Incidents

```typescript
async function fetchRecentIncidents() {
  const response = await fetch(
    'https://api.miamicrime.app/api/incidents?limit=10&severity=high'
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Usage
fetchRecentIncidents()
  .then((data) => {
    console.log(`Found ${data.pagination.total} incidents`);
    data.data.forEach((incident) => {
      console.log(`- ${incident.title} (${incident.severity})`);
    });
  })
  .catch(console.error);
```

#### Search Incidents by Keyword

```typescript
async function searchIncidents(keyword: string) {
  const params = new URLSearchParams({
    search: keyword,
    limit: '50',
  });

  const response = await fetch(
    `https://api.miamicrime.app/api/incidents?${params}`
  );

  return await response.json();
}

// Usage
searchIncidents('robbery').then((data) => {
  console.log(`Found ${data.pagination.total} incidents matching "robbery"`);
});
```

#### Get Incidents Within Map Bounds

```typescript
async function getIncidentsInBounds(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number
) {
  const bounds = `${swLat},${swLng},${neLat},${neLng}`;
  const response = await fetch(
    `https://api.miamicrime.app/api/incidents?bounds=${bounds}`
  );

  return await response.json();
}

// Usage: Get incidents in downtown Miami area
getIncidentsInBounds(25.7500, -80.2000, 25.7800, -80.1800)
  .then((data) => {
    console.log(`${data.data.length} incidents in this area`);
  });
```

### Python

#### Fetch Dashboard Stats

```python
import requests

def get_dashboard_stats(period='24h'):
    response = requests.get(
        'https://api.miamicrime.app/api/stats/dashboard',
        params={'period': period}
    )
    response.raise_for_status()
    return response.json()

# Usage
stats = get_dashboard_stats('24h')
print(f"Total incidents: {stats['summary']['totalIncidents']}")
print(f"Critical incidents: {stats['summary']['criticalIncidents']}")
```

#### Create New Incident

```python
import requests
from datetime import datetime

def create_incident(api_key, incident_data):
    response = requests.post(
        'https://api.miamicrime.app/api/incidents',
        headers={
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        },
        json=incident_data
    )
    response.raise_for_status()
    return response.json()

# Usage
incident = create_incident('your-api-key', {
    'type': 'crime',
    'category': 'theft',
    'severity': 'medium',
    'title': 'Vehicle Theft',
    'location': 'Brickell',
    'latitude': 25.7617,
    'longitude': -80.1918,
    'reportedAt': datetime.utcnow().isoformat() + 'Z',
    'sourceId': 'clx7j2k3m0010'
})
print(f"Created incident: {incident['id']}")
```

### cURL

#### Get Active Emergencies

```bash
curl -X GET "https://api.miamicrime.app/api/incidents?type=emergency&status=active" \
  -H "Accept: application/json"
```

#### Get Transit Vehicles on Route 95

```bash
curl -X GET "https://api.miamicrime.app/api/transit/live?route=95" \
  -H "Accept: application/json"
```

#### Get System Status

```bash
curl -X GET "https://api.miamicrime.app/api/stats/status" \
  -H "Accept: application/json"
```

---

## Changelog

### Version 1.0.0 (2026-01-14)

**Initial Release**

- ✅ REST API for incidents, transit, statistics, and sources
- ✅ WebSocket support for real-time updates
- ✅ Comprehensive filtering and pagination
- ✅ Geographic bounding box queries
- ✅ Dashboard statistics with caching
- ✅ Anomaly detection (spike detection)
- ✅ Status indicator system (GREEN/YELLOW/RED)
- ✅ Full TypeScript types
- ✅ Rate limiting
- ✅ Error handling

---

## Support

For questions, issues, or feature requests:

- **GitHub Issues**: https://github.com/yourusername/miamicrimetracker/issues
- **Email**: support@miamicrime.app
- **Documentation**: https://docs.miamicrime.app

---

**Last Updated:** January 14, 2026
**API Version:** 1.0.0
**License:** MIT
