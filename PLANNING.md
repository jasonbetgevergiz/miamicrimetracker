# Miami Crime & Incident Monitor Dashboard - Planning Document

## Project Overview
Real-time situation monitoring dashboard for Miami crime incidents and public transit, with auto-refresh capabilities, intelligent status indicators, and comprehensive filtering.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  Next.js 15 + Tailwind + shadcn/ui + React Query (Vercel)  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/WebSocket
                     │
┌────────────────────▼────────────────────────────────────────┐
│                      API LAYER                               │
│         Express.js + WebSocket Server (Railway)             │
├─────────────────────────────────────────────────────────────┤
│  • REST API Endpoints                                        │
│  • WebSocket for real-time updates                          │
│  • Authentication middleware                                 │
│  • Rate limiting                                             │
└────────────┬───────────────────────┬────────────────────────┘
             │                       │
┌────────────▼──────────┐  ┌────────▼──────────────────────┐
│   DATA LAYER          │  │   BACKGROUND JOBS              │
│  PostgreSQL + Prisma  │  │  BullMQ + Redis (Railway)     │
│     (Railway)         │  │                                │
├───────────────────────┤  ├────────────────────────────────┤
│ • Incidents           │  │ • Data ingestion (every 30s)  │
│ • Transit locations   │  │ • Stats aggregation           │
│ • Sources             │  │ • Alert processing            │
│ • Alert rules         │  │ • Cache invalidation          │
│ • Stats cache         │  │                                │
└───────────────────────┘  └────────────────────────────────┘
             │                       │
             │                       │
┌────────────▼───────────────────────▼────────────────────────┐
│                    EXTERNAL DATA SOURCES                     │
├─────────────────────────────────────────────────────────────┤
│ • Miami Police Open Data API                                │
│ • Miami-Dade Transit Tracker API                            │
│ • Emergency Services Feed                                   │
│ • News/Twitter APIs (optional)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema (Prisma)

### 2.1 Incidents Table
```prisma
model Incident {
  id              String   @id @default(cuid())
  externalId      String?  @unique
  type            String   // "crime", "accident", "fire", "emergency"
  category        String   // "robbery", "assault", "traffic", etc.
  severity        String   // "low", "medium", "high", "critical"
  status          String   @default("active") // "active", "resolved", "monitoring"

  title           String
  description     String?  @db.Text
  location        String
  latitude        Float
  longitude       Float
  address         String?

  reportedAt      DateTime
  resolvedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  sourceId        String
  source          Source   @relation(fields: [sourceId], references: [id])

  metadata        Json?    // Additional flexible data
  tags            String[] // ["gunfire", "officer-involved", etc.]

  @@index([reportedAt])
  @@index([severity])
  @@index([type])
  @@index([latitude, longitude])
}
```

### 2.2 Transit Vehicles Table
```prisma
model TransitVehicle {
  id              String   @id @default(cuid())
  vehicleId       String   @unique
  routeId         String
  routeName       String
  vehicleType     String   // "bus", "metrorail", "metromover"

  latitude        Float
  longitude       Float
  heading         Int?     // Direction in degrees
  speed           Float?   // mph

  status          String   @default("active") // "active", "delayed", "offline"
  occupancy       String?  // "empty", "low", "medium", "high", "full"

  lastUpdate      DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([vehicleId])
  @@index([routeId])
  @@index([lastUpdate])
}
```

### 2.3 Sources Table
```prisma
model Source {
  id              String     @id @default(cuid())
  name            String     @unique
  type            String     // "official", "news", "social", "emergency"
  url             String?
  apiEndpoint     String?
  isActive        Boolean    @default(true)
  lastFetchAt     DateTime?
  fetchInterval   Int        @default(30) // seconds

  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  incidents       Incident[]

  @@index([isActive])
}
```

### 2.4 Dashboard Stats Cache
```prisma
model DashboardStats {
  id                    String   @id @default(cuid())
  period                String   @unique // "24h", "7d", "30d"

  totalIncidents        Int
  criticalIncidents     Int
  activeIncidents       Int
  resolvedIncidents     Int

  incidentsByType       Json     // {"crime": 45, "accident": 23, ...}
  incidentsBySeverity   Json     // {"low": 12, "medium": 34, ...}
  incidentsTrend        Json     // Hourly/daily counts

  topLocations          Json     // Most incident-prone areas
  recentSpikes          Json     // Anomaly detection results

  calculatedAt          DateTime @default(now())

  @@index([period])
}
```

### 2.5 Alert Rules (Future Enhancement)
```prisma
model AlertRule {
  id              String   @id @default(cuid())
  name            String
  isActive        Boolean  @default(true)

  conditions      Json     // Filter criteria
  severity        String   // Severity to assign
  notifyChannels  String[] // ["email", "sms", "webhook"]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 3. API Endpoints

### 3.1 Incidents API

#### GET `/api/incidents`
**Query Parameters:**
- `limit` (default: 50, max: 200)
- `offset` (default: 0)
- `type` (filter: "crime", "accident", "fire", "emergency")
- `severity` (filter: "low", "medium", "high", "critical")
- `status` (filter: "active", "resolved", "monitoring")
- `search` (keyword search in title/description)
- `source` (filter by source name)
- `since` (ISO datetime - incidents after this time)
- `until` (ISO datetime - incidents before this time)
- `bounds` (map bounds: "swLat,swLng,neLat,neLng")

**Response:**
```json
{
  "data": [
    {
      "id": "clx...",
      "type": "crime",
      "category": "robbery",
      "severity": "high",
      "status": "active",
      "title": "Armed Robbery Reported",
      "description": "...",
      "location": "Downtown Miami",
      "latitude": 25.7617,
      "longitude": -80.1918,
      "address": "123 Biscayne Blvd",
      "reportedAt": "2026-01-14T14:30:00Z",
      "source": {
        "name": "Miami PD",
        "type": "official"
      },
      "tags": ["armed", "commercial"]
    }
  ],
  "pagination": {
    "total": 234,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "meta": {
    "fetchedAt": "2026-01-14T15:00:00Z"
  }
}
```

#### GET `/api/incidents/:id`
**Response:** Single incident object

#### POST `/api/incidents` (Internal/Webhook)
**Body:** Incident creation data
**Auth:** API key required

---

### 3.2 Transit API

#### GET `/api/transit/live`
**Query Parameters:**
- `type` (filter: "bus", "metrorail", "metromover")
- `route` (filter by route ID)
- `bounds` (map bounds: "swLat,swLng,neLat,neLng")

**Response:**
```json
{
  "data": [
    {
      "id": "clx...",
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
    "fetchedAt": "2026-01-14T15:00:15Z"
  }
}
```

---

### 3.3 Dashboard Stats API

#### GET `/api/stats/dashboard`
**Query Parameters:**
- `period` (default: "24h", options: "24h", "7d", "30d")

**Response:**
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
    {"hour": "00:00", "count": 3},
    {"hour": "01:00", "count": 1},
    {"hour": "02:00", "count": 2}
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
      "deviation": 3.0
    }
  ],
  "calculatedAt": "2026-01-14T15:00:00Z"
}
```

#### GET `/api/stats/timeline`
**Query Parameters:**
- `period` (default: "24h", options: "24h", "7d")
- `granularity` (default: "hourly", options: "hourly", "daily")

**Response:** Time-series data for visualization

---

### 3.4 Sources API

#### GET `/api/sources`
**Response:** List of all data sources and their status

---

### 3.5 WebSocket API

#### WS `/ws`
**Events from server:**
- `incident:new` - New incident created
- `incident:update` - Incident updated
- `incident:resolved` - Incident resolved
- `transit:update` - Bulk transit vehicle updates (every 30s)
- `stats:update` - Dashboard stats refreshed

**Events from client:**
- `subscribe:incidents` - Subscribe to incident updates
- `subscribe:transit` - Subscribe to transit updates
- `subscribe:stats` - Subscribe to stats updates
- `unsubscribe:*` - Unsubscribe from updates

---

## 4. UI Structure (Next.js 15)

### 4.1 Pages/Routes
```
/                          # Dashboard home
/map                       # Full-screen map view
/timeline                  # Timeline view
/analytics                 # Analytics & reports (future)
/settings                  # User preferences
```

### 4.2 Component Hierarchy

```
app/
├── layout.tsx                    # Root layout with providers
├── page.tsx                      # Dashboard home
├── map/
│   └── page.tsx                  # Full-screen map
├── timeline/
│   └── page.tsx                  # Timeline view
│
components/
├── dashboard/
│   ├── DashboardLayout.tsx       # Main dashboard layout
│   ├── StatsCards.tsx            # Summary stats (4 cards)
│   ├── StatusIndicator.tsx       # GREEN/YELLOW/RED status
│   ├── IncidentList.tsx          # List view of incidents
│   ├── IncidentCard.tsx          # Individual incident card
│   └── RecentSpikes.tsx          # Anomaly alerts
│
├── map/
│   ├── MapView.tsx               # Main map component (Mapbox/Leaflet)
│   ├── IncidentMarker.tsx        # Incident pins with severity colors
│   ├── TransitMarker.tsx         # Transit vehicle markers
│   ├── HeatmapLayer.tsx          # Density heatmap
│   └── MapControls.tsx           # Zoom, layers, etc.
│
├── timeline/
│   ├── TimelineView.tsx          # Timeline visualization
│   ├── TimelineEvent.tsx         # Event card in timeline
│   └── TimeRangeSelector.tsx     # 24h, 7d selector
│
├── filters/
│   ├── FilterBar.tsx             # Main filter container
│   ├── SearchInput.tsx           # Keyword search
│   ├── TypeFilter.tsx            # Incident type checkboxes
│   ├── SeverityFilter.tsx        # Severity filter
│   └── SourceFilter.tsx          # Source filter
│
├── ui/                           # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── checkbox.tsx
│   ├── dialog.tsx
│   └── ... (other shadcn components)
│
└── shared/
    ├── Header.tsx                # App header with nav
    ├── AutoRefreshIndicator.tsx  # Shows "Refreshing..." status
    └── ErrorBoundary.tsx         # Error handling
```

### 4.3 Key UI Features

#### Dashboard Stats Cards (Top Row)
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total        │ Critical     │ Active       │ Resolved     │
│ Incidents    │ Incidents    │ Incidents    │ Today        │
│              │              │              │              │
│    87        │     12       │     34       │     53       │
│  ↑ 23%       │  ↑ 45%       │  ↓ 12%       │  ↑ 18%       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

#### Status Indicator Logic
- **GREEN (Normal)**: < 3 critical incidents in last hour
- **YELLOW (Watch)**: 3-5 critical incidents OR unusual spike detected
- **RED (Critical)**: > 5 critical incidents OR multiple active emergencies

#### Map View
- Incident markers color-coded by severity:
  - 🔴 Critical (red)
  - 🟠 High (orange)
  - 🟡 Medium (yellow)
  - 🟢 Low (green)
- Transit vehicles:
  - 🚌 Buses (blue)
  - 🚇 Metrorail (purple)
  - 🚡 Metromover (teal)
- Click marker → Show incident/vehicle details popup
- Cluster markers when zoomed out

#### Timeline View
```
15:00 ────────────────────────────────────────
       🔴 Armed Robbery - Downtown Miami

14:30 ────────────────────────────────────────
       🟡 Traffic Accident - I-95 Northbound

14:15 ────────────────────────────────────────
       🟠 Fire Alarm - Brickell Ave

14:00 ────────────────────────────────────────
```

---

## 5. Data Sources & Integration

### 5.1 Miami Police Open Data
- **API**: https://data.miamidade.gov/resource/crimes.json
- **Rate Limit**: 1000 requests/day
- **Update Frequency**: Every 30 seconds via BullMQ job
- **Data Mapping**: Map to Incident schema

### 5.2 Miami-Dade Transit Tracker
- **API**: http://www.miamidade.gov/transit/mobile/
- **Real-time Bus/Rail Locations**: GTFS-realtime feed
- **Update Frequency**: Every 15-30 seconds
- **Data Mapping**: Map to TransitVehicle schema

### 5.3 Emergency Services (Optional)
- **Scanner feeds**: If available via API
- **News APIs**: Twitter API, local news RSS
- **Weather alerts**: NWS API for severe weather

---

## 6. Real-Time Updates Strategy

### 6.1 Backend Jobs (BullMQ)

```typescript
// Job: Fetch Incidents (runs every 30s)
Queue: 'data-ingestion'
Jobs:
  - fetch-incidents-miami-pd
  - fetch-incidents-emergency-feed
  - fetch-news-alerts

// Job: Fetch Transit (runs every 15s)
Queue: 'transit-ingestion'
Jobs:
  - fetch-transit-locations

// Job: Calculate Stats (runs every 60s)
Queue: 'stats-processing'
Jobs:
  - calculate-dashboard-stats
  - detect-anomalies

// Job: Cleanup (runs every 5 minutes)
Queue: 'maintenance'
Jobs:
  - cleanup-old-incidents
  - cleanup-stale-transit
```

### 6.2 WebSocket Implementation

**Server:**
```typescript
// When new incident is ingested
io.emit('incident:new', incident);

// When incident is updated
io.emit('incident:update', incident);

// Bulk transit updates (every 15s)
io.emit('transit:update', vehicles);

// Stats refresh (every 60s)
io.emit('stats:update', stats);
```

**Client:**
```typescript
// React Query + WebSocket integration
- useIncidents() hook with WebSocket subscription
- useTransit() hook with WebSocket subscription
- useDashboardStats() hook with WebSocket subscription
- Auto-reconnect on disconnect
- Fallback to HTTP polling if WebSocket fails
```

### 6.3 Caching Strategy (Redis)

```
Key Pattern:
- incidents:latest:30s       # Last 30s of incidents
- incidents:filter:{hash}    # Cached filter results
- transit:latest             # Latest transit positions
- stats:dashboard:24h        # Dashboard stats cache
- stats:dashboard:7d
- stats:timeline:{period}    # Timeline data cache

TTL:
- incidents:* → 60s
- transit:* → 30s
- stats:* → 300s (5 min)
```

---

## 7. Technology Stack Details

### 7.1 Frontend (Next.js 15 on Vercel)

**Dependencies:**
```json
{
  "next": "15.x",
  "react": "^19.x",
  "react-dom": "^19.x",
  "typescript": "^5.x",
  "tailwindcss": "^4.x",
  "@tanstack/react-query": "^5.x",
  "socket.io-client": "^4.x",
  "react-map-gl": "^7.x",
  "mapbox-gl": "^3.x",
  "recharts": "^2.x",
  "date-fns": "^3.x",
  "lucide-react": "latest",
  "zustand": "^4.x"
}
```

**shadcn/ui Components to Install:**
- button, card, badge, input, select, checkbox
- dialog, dropdown-menu, tabs, toast
- table, skeleton, alert

### 7.2 Backend (Express on Railway)

**Dependencies:**
```json
{
  "express": "^4.x",
  "socket.io": "^4.x",
  "prisma": "^6.x",
  "@prisma/client": "^6.x",
  "bullmq": "^5.x",
  "ioredis": "^5.x",
  "axios": "^1.x",
  "zod": "^3.x",
  "helmet": "^8.x",
  "cors": "^2.x",
  "compression": "^1.x",
  "winston": "^3.x"
}
```

### 7.3 Database
- PostgreSQL 16 (Railway)
- Prisma ORM for migrations and queries
- PostGIS extension for geospatial queries (optional)

### 7.4 Cache & Queue
- Redis 7 (Railway) - Single instance for both cache and BullMQ
- BullMQ for background job processing

---

## 8. Deployment Configuration

### 8.1 Vercel (Frontend)
```
Project: miami-crime-tracker-frontend
Framework: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install

Environment Variables:
- NEXT_PUBLIC_API_URL=https://api-miami-crime.railway.app
- NEXT_PUBLIC_WS_URL=wss://api-miami-crime.railway.app
- NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx (if using Mapbox)
```

### 8.2 Railway (Backend)
```
Service: miami-crime-api
Start Command: npm run start:prod

Environment Variables:
- DATABASE_URL=postgresql://...
- REDIS_URL=redis://...
- PORT=3000
- NODE_ENV=production
- CORS_ORIGIN=https://miami-crime-tracker.vercel.app
- API_KEY=xxx (for internal endpoints)
- MIAMI_PD_API_KEY=xxx (if required)
- TRANSIT_API_KEY=xxx (if required)
```

### 8.3 Railway (Database)
```
Service: postgresql
Version: 16
Persistent Storage: Yes
```

### 8.4 Railway (Redis)
```
Service: redis
Version: 7
Persistent Storage: Yes (for BullMQ job data)
```

---

## 9. Development Workflow

### 9.1 Project Structure
```
miamicrimetracker/
├── apps/
│   ├── frontend/              # Next.js app
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── hooks/
│   │   └── package.json
│   │
│   └── backend/               # Express API
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── jobs/
│       │   ├── websocket/
│       │   └── server.ts
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
│
├── package.json               # Root package.json (monorepo)
├── turbo.json                 # Turborepo config (optional)
└── README.md
```

### 9.2 Local Development Setup
```bash
# 1. Install dependencies
npm install

# 2. Set up database (Docker)
docker-compose up -d postgres redis

# 3. Run Prisma migrations
cd apps/backend
npx prisma migrate dev

# 4. Seed database (optional)
npx prisma db seed

# 5. Start backend
npm run dev

# 6. Start frontend (in another terminal)
cd apps/frontend
npm run dev
```

### 9.3 Environment Files
```
apps/frontend/.env.local
apps/backend/.env
docker-compose.yml (for local dev)
```

---

## 10. API Documentation Implementation

Since the task requires comprehensive API documentation, we'll add:

### 10.1 OpenAPI/Swagger Documentation
- Install `swagger-ui-express` and `swagger-jsdoc`
- Generate OpenAPI 3.0 spec
- Serve at `/api/docs`
- Include all endpoints with request/response schemas

### 10.2 Code Documentation
- JSDoc comments for all functions and classes
- TypeScript interfaces for all data models
- Inline comments for complex logic

### 10.3 README Documentation
- Architecture overview
- Setup instructions
- API usage examples
- WebSocket event documentation
- Deployment guide

---

## 11. Next Steps

1. ✅ Planning document created
2. Initialize monorepo structure
3. Set up backend with Express + Prisma
4. Create database schema and migrations
5. Implement data ingestion jobs
6. Build REST API endpoints
7. Add WebSocket server
8. Initialize Next.js frontend
9. Install and configure shadcn/ui
10. Build dashboard components
11. Implement map view
12. Add real-time subscriptions
13. Create comprehensive API documentation
14. Deploy to Vercel + Railway
15. Testing and optimization

---

## 12. Success Metrics

- ✅ Real-time updates working (< 30s latency)
- ✅ Dashboard loads in < 2s
- ✅ Map renders 1000+ markers smoothly
- ✅ WebSocket maintains stable connection
- ✅ 99.9% uptime on Railway
- ✅ Comprehensive API documentation
- ✅ All core features implemented
