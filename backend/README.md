# Miami Crime Tracker - Backend API

Real-time crime and incident monitoring backend built with Node.js, Express, Prisma, and BullMQ.

## 🛠 Tech Stack

- **Node.js 20+** - Runtime
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Prisma ORM** - Database toolkit
- **PostgreSQL** - Database
- **Redis** - Caching & job queue
- **BullMQ** - Background jobs
- **Socket.IO** - Real-time WebSocket
- **Zod** - Validation
- **Winston** - Logging

## 📋 Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker & Docker Compose (for local development)

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd backend
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/miami_crime_tracker?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3001"
API_KEY="your-secret-key"
```

### 3. Start Dependencies

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 4. Setup Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database with sample data
npm run prisma:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Sample data seeder
├── src/
│   ├── jobs/                  # Background jobs
│   │   ├── index.ts           # Job queue setup
│   │   ├── fetchIncidents.ts  # Incident ingestion
│   │   ├── fetchTransit.ts    # Transit data ingestion
│   │   ├── calculateStats.ts  # Stats calculation
│   │   └── cleanup.ts         # Data cleanup
│   ├── lib/                   # Utilities
│   │   ├── prisma.ts          # Database client
│   │   ├── redis.ts           # Redis client
│   │   └── logger.ts          # Winston logger
│   ├── middleware/            # Express middleware
│   │   ├── errorHandler.ts    # Error handling
│   │   └── requestLogger.ts   # Request logging
│   ├── routes/                # API routes
│   │   ├── incidents.ts       # Incident endpoints
│   │   ├── transit.ts         # Transit endpoints
│   │   ├── stats.ts           # Statistics endpoints
│   │   └── sources.ts         # Data sources endpoints
│   ├── websocket/             # WebSocket
│   │   └── index.ts           # Socket.IO setup
│   └── server.ts              # Main server
├── .env.example               # Environment template
├── docker-compose.yml         # Local development services
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── Procfile                   # Railway deployment
```

## 🔌 API Endpoints

### Health Check
```
GET /health
```

### Incidents
```
GET    /api/incidents          # List incidents (with filters)
GET    /api/incidents/:id      # Get single incident
POST   /api/incidents          # Create incident (requires API key)
PATCH  /api/incidents/:id      # Update incident (requires API key)
```

### Transit
```
GET    /api/transit/live       # Live vehicle locations
GET    /api/transit/routes     # List routes
GET    /api/transit/:vehicleId # Get vehicle details
```

### Statistics
```
GET    /api/stats/dashboard    # Dashboard statistics
GET    /api/stats/timeline     # Timeline data
GET    /api/stats/status       # System status (GREEN/YELLOW/RED)
```

### Sources
```
GET    /api/sources            # List data sources
GET    /api/sources/:id        # Get source details
```

### WebSocket Events

**From Server:**
- `incident:new` - New incident created
- `incident:update` - Incident updated
- `incident:resolved` - Incident resolved
- `transit:update` - Transit vehicles updated
- `stats:update` - Statistics refreshed

**From Client:**
- `subscribe:incidents` - Subscribe to incident updates
- `subscribe:transit` - Subscribe to transit updates
- `subscribe:stats` - Subscribe to stats updates
- `ping` - Health check

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:seed      # Seed database
npm run prisma:studio    # Open Prisma Studio GUI
npm run prisma:reset     # Reset database (dev only)

# Code Quality
npm run type-check       # TypeScript type checking
npm run lint             # ESLint
npm run format           # Prettier
```

### Database Migrations

```bash
# Create new migration
npm run prisma:migrate

# Deploy migrations (production)
npm run prisma:deploy

# View database in GUI
npm run prisma:studio
```

### Background Jobs

The system runs these automated jobs:

| Job | Frequency | Description |
|-----|-----------|-------------|
| `fetch-incidents` | 30s | Fetch new incidents from sources |
| `fetch-transit` | 15s | Update transit vehicle locations |
| `calculate-stats` | 60s | Calculate dashboard statistics |
| `cleanup` | 5min | Remove stale data |

## 🚢 Deployment

### Railway

1. Push code to GitHub
2. Create new project on Railway
3. Add PostgreSQL service
4. Add Redis service
5. Add backend service from GitHub
6. Set environment variables:

```env
DATABASE_URL=<from Railway PostgreSQL>
REDIS_URL=<from Railway Redis>
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-frontend.vercel.app
API_KEY=<generate secure key>
```

7. Deploy!

Railway will automatically:
- Install dependencies
- Run `prisma migrate deploy`
- Build TypeScript
- Start server

### Manual Deployment

```bash
# Build
npm run build

# Start
npm run start:prod
```

## 🔒 Security

### API Authentication

Protected endpoints require API key in header:
```http
X-API-Key: your-api-key-here
```

### Rate Limiting

- 100 requests/minute per IP for read operations
- 20 requests/minute for write operations

### CORS

Configure allowed origins in `.env`:
```env
CORS_ORIGIN="http://localhost:3001,https://your-app.com"
```

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-14T15:00:00Z",
  "uptime": 3600,
  "environment": "production",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### Logs

- Development: Console with colors
- Production: Files in `logs/` directory
  - `logs/error.log` - Error logs only
  - `logs/combined.log` - All logs

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli ping

# View Redis logs
docker-compose logs redis
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Prisma Client Issues

```bash
# Regenerate Prisma client
npm run prisma:generate

# If issues persist, delete and regenerate
rm -rf node_modules/.prisma
npm run prisma:generate
```

## 🧪 Testing

### Manual API Testing

```bash
# Get incidents
curl http://localhost:3000/api/incidents

# Get dashboard stats
curl http://localhost:3000/api/stats/dashboard?period=24h

# Create incident (requires API key)
curl -X POST http://localhost:3000/api/incidents \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "crime",
    "category": "theft",
    "severity": "medium",
    "title": "Test Incident",
    "location": "Downtown Miami",
    "latitude": 25.7617,
    "longitude": -80.1918,
    "reportedAt": "2026-01-14T15:00:00Z",
    "sourceId": "<source-id-from-database>"
  }'
```

### WebSocket Testing

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('subscribe:incidents');
});

socket.on('incident:new', (incident) => {
  console.log('New incident:', incident);
});
```

## 📝 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | - | PostgreSQL connection string |
| `REDIS_URL` | ✅ | - | Redis connection string |
| `PORT` | ❌ | 3000 | Server port |
| `NODE_ENV` | ❌ | development | Environment (development/production) |
| `CORS_ORIGIN` | ❌ | http://localhost:3001 | Allowed CORS origins |
| `API_KEY` | ✅ | - | API key for protected endpoints |
| `LOG_LEVEL` | ❌ | info | Logging level (error/warn/info/debug) |

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Run type check: `npm run type-check`
4. Run linter: `npm run lint`
5. Test locally
6. Create pull request

## 📄 License

MIT
