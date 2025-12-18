# CacheMaster

A high-performance, Redis-like in-memory caching service built with TypeScript and Node.js. Features advanced eviction policies, a RESTful API, real-time monitoring, and a visual dashboard.

## Features

### Core Functionality
- GET, SET, DELETE, EXISTS operations with O(1) complexity
- TTL (Time-To-Live) expiration with automatic cleanup
- Atomic increment operations for counters
- Batch operations for high-throughput scenarios
- Configurable memory limits with automatic enforcement

### Eviction Policies
- **LRU** (Least Recently Used) - Removes oldest accessed items
- **LFU** (Least Frequently Used) - Removes least accessed items
- **FIFO** (First In, First Out) - Removes oldest inserted items

### Monitoring
- Real-time statistics (hits, misses, hit rate, memory usage)
- Health checks with detailed system metrics
- Structured logging with Winston
- Performance metrics (ops/sec, latency tracking)

### Production Ready
- Security middleware (Helmet, CORS, rate limiting)
- Input validation with Joi schemas
- Graceful shutdown handling
- Docker containerization with multi-stage builds
- Comprehensive test suite (76+ tests, 60%+ coverage)

### Visual Dashboard
- Real-time memory map visualization
- Interactive terminal for cache operations
- Live metrics with sparklines
- Stress testing simulation

## Performance

| Operation | Throughput | Avg Latency |
|-----------|------------|-------------|
| GET       | 35,000+ ops/sec | <0.03ms |
| SET       | 30,000+ ops/sec | <0.04ms |
| Mixed     | 25,000+ ops/sec | <0.05ms |

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

The API will be available at `http://localhost:3000`

### Frontend Setup

```bash
npm install
npm run dev
```

The dashboard will be available at `http://localhost:5173`

### Docker Deployment

```bash
docker-compose up --build
```

## API Reference

### Base URL
```
http://localhost:3000/api
```

### Core Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/get/:key` | Retrieve a value |
| POST | `/api/set` | Store a key-value pair |
| DELETE | `/api/delete/:key` | Remove a key |
| GET | `/api/exists/:key` | Check if key exists |
| POST | `/api/increment/:key` | Atomic increment |
| POST | `/api/update-ttl/:key` | Update TTL |

### Batch Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/batch/set` | Set multiple keys |
| POST | `/api/batch/get` | Get multiple keys |
| POST | `/api/batch/delete` | Delete multiple keys |

### Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/stats` | Cache statistics |
| POST | `/api/stats/reset` | Reset statistics |
| GET | `/api/config` | Current configuration |

### Example Requests

**Set a value:**
```bash
curl -X POST http://localhost:3000/api/set \
  -H "Content-Type: application/json" \
  -d '{"key": "user:123", "value": {"name": "John"}, "ttl": 3600000}'
```

**Get a value:**
```bash
curl http://localhost:3000/api/get/user:123
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `EVICTION_POLICY` | LRU | Eviction policy (LRU/LFU/FIFO) |
| `MAX_MEMORY_MB` | 512 | Maximum memory in MB |
| `MAX_KEYS` | 100000 | Maximum number of keys |
| `CLEANUP_INTERVAL_MS` | 60000 | Cleanup interval |
| `LOG_LEVEL` | info | Logging level |
| `RATE_LIMIT_PER_MINUTE` | 100 | Rate limit per IP |

## Architecture

```
HTTP Clients
    |
Express.js Server
    |-- Security Middleware (Helmet, CORS, Rate Limiting)
    |-- Performance Middleware (Compression, Logging)
    |-- API Routes
    |
Cache Engine
    |-- Storage (Map)
    |-- Eviction Policy (LRU/LFU/FIFO)
    |-- TTL Manager
    |-- Statistics Tracker
    |
Background Workers
    |-- Cleanup Worker (expired key removal)
```

## Project Structure

```
cachemaster/
├── backend/
│   ├── src/
│   │   ├── cache/           # Core cache logic and eviction policies
│   │   ├── api/             # Express routes and middleware
│   │   ├── config/          # Configuration management
│   │   ├── utils/           # Logger and helpers
│   │   └── workers/         # Background processes
│   └── benchmarks/          # Performance tests
├── index.html               # Frontend entry
├── index.tsx                # React dashboard
├── Dockerfile
└── docker-compose.yml
```

## Testing

```bash
cd backend

# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run benchmarks
npm run benchmark
```

## License

MIT