# Miami Crime Tracker Backend - Complete Setup Guide

This guide will walk you through setting up the backend from scratch.

## 📦 What's Included

### ✅ Complete Backend API
- **Express.js** server with TypeScript
- **Prisma ORM** with PostgreSQL schema
- **Redis** caching and job queues
- **BullMQ** background job processing
- **Socket.IO** real-time WebSocket updates
- **Zod** request validation
- **Winston** structured logging
- Complete error handling
- Rate limiting
- CORS configuration
- Health check endpoints

### ✅ Database Schema (Prisma)
- **Incidents** - Crime and emergency events
- **TransitVehicles** - Live Miami-Dade transit tracking
- **Sources** - Data source configuration
- **DashboardStats** - Cached statistics
- **AlertRules** - Notification rules (future feature)

### ✅ API Routes
- `/api/incidents` - CRUD operations with advanced filtering
- `/api/transit` - Live transit vehicle locations
- `/api/stats` - Dashboard statistics and analytics
- `/api/sources` - Data source management

### ✅ Background Jobs (BullMQ)
- Incident ingestion (every 30s)
- Transit tracking (every 15s)
- Stats calculation (every 60s)
- Data cleanup (every 5min)

### ✅ Real-time Features (WebSocket)
- New incident notifications
- Transit vehicle updates
- Dashboard stats updates
- Subscribe/unsubscribe system

---

## 🚀 Step-by-Step Setup

### Step 1: Install Dependencies

```bash
npm install
```

This installs all required packages:
- express, socket.io, cors, helmet
- prisma, @prisma/client
- bullmq, ioredis
- zod, winston, date-fns
- TypeScript and type definitions

### Step 2: Start Services

```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d

# Verify services are healthy
docker-compose ps
```

You should see:
```
miami-crime-postgres   running   (healthy)
miami-crime-redis      running   (healthy)
```

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env
```

The `.env` file contains:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/miami_crime_tracker?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3001"
API_KEY="dev-api-key-change-in-production"
LOG_LEVEL="info"
```

### Step 4: Setup Database

```bash
# Generate Prisma client
npm run prisma:generate

# Create database tables
npm run prisma:migrate

# Seed with sample data (150 incidents, 80 transit vehicles)
npm run prisma:seed
```

You should see:
```
✓ Cleared existing data
✓ Created 3 sources
✓ Created 150 incidents
✓ Created 80 transit vehicles
✓ Created 2 alert rules
✅ Database seeding completed successfully!
```

### Step 5: Start Development Server

```bash
npm run dev
```

You should see:
```
🚀 Starting Miami Crime Tracker Backend...
✓ Database connected successfully
✓ Redis connection established (BullMQ)
✓ Redis cache connected
✓ Server running on port 3000
✓ Environment: development
✓ CORS enabled for: http://localhost:3001
✓ WebSocket server initialized
✓ Background jobs started
✓ Repeating jobs scheduled

🌐 Ready to accept connections
```

---

## 🧪 Testing the API

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-14T15:00:00Z",
  "uptime": 10.5,
  "environment": "development",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### 2. List Incidents

```bash
curl "http://localhost:3000/api/incidents?limit=5"
```

Expected response:
```json
{
  "data": [
    {
      "id": "clx...",
      "type": "crime",
      "category": "robbery",
      "severity": "high",
      "status": "active",
      "title": "Armed Robbery",
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
    "total": 150,
    "limit": 5,
    "offset": 0,
    "hasMore": true
  }
}
```

### 3. Search Incidents

```bash
curl "http://localhost:3000/api/incidents?search=robbery&severity=high"
```

### 4. Get Live Transit

```bash
curl "http://localhost:3000/api/transit/live?type=bus&limit=10"
```

### 5. Dashboard Stats

```bash
curl "http://localhost:3000/api/stats/dashboard?period=24h"
```

Expected response:
```json
{
  "period": "24h",
  "summary": {
    "totalIncidents": 50,
    "criticalIncidents": 5,
    "activeIncidents": 30,
    "resolvedIncidents": 20
  },
  "byType": {
    "crime": 25,
    "accident": 15,
    "fire": 5,
    "emergency": 5
  },
  "trend": [...],
  "topLocations": [...],
  "recentSpikes": [...]
}
```

### 6. System Status

```bash
curl "http://localhost:3000/api/stats/status"
```

Expected response:
```json
{
  "status": "GREEN",
  "reason": "Normal incident levels",
  "metrics": {
    "criticalIncidentsLastHour": 2,
    "activeEmergencies": 0
  }
}
```

---

## 🔌 Testing WebSocket

Create a test file `test-websocket.js`:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✓ Connected to WebSocket');

  // Subscribe to incidents
  socket.emit('subscribe:incidents');

  // Subscribe to transit
  socket.emit('subscribe:transit');

  // Subscribe to stats
  socket.emit('subscribe:stats');
});

socket.on('subscribed:incidents', () => {
  console.log('✓ Subscribed to incidents');
});

socket.on('subscribed:transit', () => {
  console.log('✓ Subscribed to transit');
});

socket.on('subscribed:stats', () => {
  console.log('✓ Subscribed to stats');
});

socket.on('incident:new', (incident) => {
  console.log('🚨 New incident:', incident.title);
});

socket.on('transit:update', (data) => {
  console.log('🚌 Transit update:', data.vehicles.length, 'vehicles');
});

socket.on('stats:update', (stats) => {
  console.log('📊 Stats update:', stats.summary);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

Run:
```bash
node test-websocket.js
```

---

## 📊 Viewing Database

Open Prisma Studio to view/edit database records:

```bash
npm run prisma:studio
```

This opens a GUI at `http://localhost:5555` where you can:
- Browse all tables
- View/edit records
- Run queries
- See relationships

---

## 🔍 Common Commands

### Development
```bash
npm run dev              # Start with hot reload
npm run build            # Compile TypeScript
npm start                # Start production server
npm run type-check       # Check types
```

### Database
```bash
npm run prisma:studio    # Open database GUI
npm run prisma:migrate   # Create new migration
npm run prisma:seed      # Seed sample data
npm run prisma:reset     # Reset database (WARNING: deletes all data)
```

### Docker
```bash
docker-compose up -d           # Start services
docker-compose down            # Stop services
docker-compose logs postgres   # View PostgreSQL logs
docker-compose logs redis      # View Redis logs
docker-compose restart         # Restart all services
```

---

## 🎯 Features Verified

After setup, you should have:

✅ **Express Server** running on port 3000
✅ **PostgreSQL** with 5 tables and sample data
✅ **Redis** for caching and job queues
✅ **WebSocket Server** for real-time updates
✅ **Background Jobs** running every 15-60 seconds
✅ **API Endpoints** with validation and error handling
✅ **Health Monitoring** via `/health` endpoint
✅ **CORS Protection** configured
✅ **Rate Limiting** (100 req/min)
✅ **Structured Logging** with Winston
✅ **Type Safety** with TypeScript

---

## 📝 Next Steps

1. **Frontend Integration**: Connect Next.js frontend to this API
2. **External APIs**: Integrate real Miami PD and Transit APIs
3. **Authentication**: Add user authentication system
4. **Notifications**: Implement email/SMS alerts
5. **Analytics**: Add advanced analytics and ML
6. **Monitoring**: Set up Datadog/Sentry
7. **Testing**: Add unit and integration tests
8. **Documentation**: Generate OpenAPI/Swagger docs

---

## 🐛 Troubleshooting

### "Port 3000 already in use"
```bash
lsof -i :3000
kill -9 <PID>
```

### "Cannot connect to database"
```bash
docker-compose restart postgres
docker-compose logs postgres
```

### "Redis connection failed"
```bash
docker-compose restart redis
docker-compose exec redis redis-cli ping
```

### "Prisma client not generated"
```bash
npm run prisma:generate
```

### Clear everything and start fresh
```bash
docker-compose down -v
npm run prisma:reset
docker-compose up -d
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

---

## 🎉 Success!

Your Miami Crime Tracker backend is now running with:

- ✅ 150 sample incidents
- ✅ 80 transit vehicles
- ✅ 3 data sources
- ✅ Real-time WebSocket updates
- ✅ Background jobs processing
- ✅ Full REST API
- ✅ Dashboard statistics

You're ready to build the frontend or integrate with external services!

---

## 📚 Additional Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Socket.IO Docs](https://socket.io/docs/v4/)
- [BullMQ Guide](https://docs.bullmq.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Need help?** Check the main README.md or create an issue on GitHub.
