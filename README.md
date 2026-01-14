# Miami Crime & Incident Monitor Dashboard

Real-time situation monitoring dashboard for Miami crime incidents and public transit, with auto-refresh capabilities, intelligent status indicators, and comprehensive filtering.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- ✅ **Real-time Updates**: Auto-refresh every 15-30 seconds with WebSocket support
- ✅ **Status Indicators**: GREEN/YELLOW/RED system status based on incident activity
- ✅ **Advanced Filtering**: Search by keyword, type, severity, location, and time range
- ✅ **Timeline View**: Visual timeline of incidents over 24h/7d/30d periods
- ✅ **Dashboard Statistics**: Pre-calculated metrics with anomaly detection
- ✅ **Live Transit Tracking**: Real-time Miami-Dade transit vehicle locations
- ✅ **Geographic Queries**: Bounding box filtering for map-based applications
- ✅ **Comprehensive API**: Fully documented REST and WebSocket APIs

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **Tailwind CSS 4** - Utility-first CSS framework
- **shadcn/ui** - Re-usable component library
- **React Query** - Data fetching and caching
- **Socket.IO Client** - WebSocket connections
- **React Map GL** - Map visualization
- **Recharts** - Data visualization

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **BullMQ** - Background job processing
- **Redis** - Caching and job queue
- **Socket.IO** - WebSocket server
- **Winston** - Logging

### Deployment
- **Vercel** - Frontend hosting
- **Railway** - Backend, database, and Redis hosting

## Project Structure

```
miamicrimetracker/
├── apps/
│   ├── frontend/              # Next.js frontend application
│   │   ├── app/               # Next.js app directory
│   │   ├── components/        # React components
│   │   ├── lib/               # Utility functions
│   │   └── package.json
│   │
│   └── backend/               # Express backend API
│       ├── src/
│       │   ├── routes/        # API route handlers
│       │   ├── services/      # Business logic
│       │   ├── jobs/          # Background jobs
│       │   ├── websocket/     # WebSocket handlers
│       │   ├── middleware/    # Express middleware
│       │   ├── utils/         # Utility functions
│       │   └── server.ts      # Main server file
│       ├── prisma/
│       │   ├── schema.prisma  # Database schema
│       │   └── seed.ts        # Database seeding
│       └── package.json
│
├── docker-compose.yml         # Local development services
├── PLANNING.md                # Comprehensive planning document
├── API_DOCUMENTATION.md       # Complete API documentation
└── README.md                  # This file
```

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** (for local PostgreSQL and Redis)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/miamicrimetracker.git
cd miamicrimetracker
```

2. **Install dependencies**

```bash
npm install
```

3. **Start PostgreSQL and Redis**

```bash
docker-compose up -d
```

4. **Set up the backend**

```bash
cd apps/backend

# Copy environment file
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database with sample data
npm run prisma:seed
```

5. **Set up the frontend**

```bash
cd apps/frontend

# Copy environment file
cp .env.local.example .env.local
```

6. **Start development servers**

In one terminal (backend):
```bash
cd apps/backend
npm run dev
```

In another terminal (frontend):
```bash
cd apps/frontend
npm run dev
```

7. **Access the application**

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- API Documentation: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### Prisma Studio (Database GUI)

To view and edit database records:

```bash
cd apps/backend
npx prisma studio
```

Access at: http://localhost:5555

## Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/miami_crime_tracker?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN="http://localhost:3001"

# API Keys
API_KEY="dev-api-key-change-in-production"

# External APIs
MIAMI_PD_API_KEY=""
TRANSIT_API_KEY=""
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_MAPBOX_TOKEN=  # Optional
```

## API Documentation

Comprehensive API documentation is available in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

### Quick Reference

**Base URL:** `http://localhost:3000` (Development)

#### Main Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/incidents` | GET | List incidents with filtering |
| `/api/incidents/:id` | GET | Get single incident |
| `/api/transit/live` | GET | Get live transit locations |
| `/api/stats/dashboard` | GET | Get dashboard statistics |
| `/api/stats/status` | GET | Get system status (GREEN/YELLOW/RED) |
| `/api/sources` | GET | List data sources |

#### WebSocket Events

| Event | Description |
|-------|-------------|
| `incident:new` | New incident created |
| `incident:update` | Incident updated |
| `transit:update` | Transit vehicles updated (bulk) |
| `stats:update` | Statistics refreshed |

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete details, examples, and code samples.

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key tables:

- **incidents** - Crime and emergency incidents
- **transit_vehicles** - Live transit vehicle locations
- **sources** - Data sources configuration
- **dashboard_stats** - Cached statistics
- **alert_rules** - Alert configuration (future)

Full schema: [apps/backend/prisma/schema.prisma](./apps/backend/prisma/schema.prisma)

## Background Jobs

The system runs several background jobs using BullMQ:

| Job | Frequency | Description |
|-----|-----------|-------------|
| `fetch-incidents` | 30s | Fetch new incidents from external sources |
| `fetch-transit` | 15s | Fetch live transit vehicle locations |
| `calculate-stats` | 60s | Calculate and cache dashboard statistics |
| `cleanup` | 5min | Remove stale data |

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Deploy

**Environment Variables:**
```
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXT_PUBLIC_WS_URL=wss://your-api.railway.app
```

### Backend (Railway)

1. Create new project on Railway
2. Add PostgreSQL service
3. Add Redis service
4. Add backend service
5. Configure environment variables
6. Deploy

**Environment Variables:**
```
DATABASE_URL=<from Railway PostgreSQL>
REDIS_URL=<from Railway Redis>
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.vercel.app
API_KEY=<generate secure key>
```

## Development

### Running Tests

```bash
# Backend tests
cd apps/backend
npm test

# Frontend tests
cd apps/frontend
npm test
```

### Type Checking

```bash
# Backend
cd apps/backend
npm run type-check

# Frontend
cd apps/frontend
npm run type-check
```

### Linting

```bash
# Both
npm run lint
```

### Database Migrations

```bash
cd apps/backend

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Apply migrations in production
npx prisma migrate deploy
```

## Architecture

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
```

## Data Sources

The system integrates with:

- **Miami Police Department** - Open data portal for crime incidents
- **Miami-Dade Transit** - Real-time vehicle tracking API
- **Emergency Services** - Emergency alerts and responses

*Note: Current implementation includes stub data fetchers. Configure actual API keys in `.env` for production use.*

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Email/SMS alerts for critical incidents
- [ ] User authentication and saved preferences
- [ ] Custom alert rules configuration
- [ ] Historical data analysis and trends
- [ ] Mobile app (React Native)
- [ ] Advanced map features (heatmaps, clustering)
- [ ] Integration with more data sources
- [ ] Machine learning for anomaly detection

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

For questions or issues:

- **Documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **GitHub Issues**: https://github.com/yourusername/miamicrimetracker/issues
- **Email**: support@miamicrime.app

## Acknowledgments

- Miami Police Department for open data access
- Miami-Dade Transit for real-time vehicle data
- Open source community for amazing tools and libraries

---

**Built with ❤️ for Miami**
