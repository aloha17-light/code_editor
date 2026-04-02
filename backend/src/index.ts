// =============================================================================
// Express Server Entrypoint (Layer 2: API Gateway)
// =============================================================================
// This is the main entry point for the Node.js backend.
// Responsibilities:
//   1. Load environment variables
//   2. Initialize Express with security & logging middleware
//   3. Mount API routes
//   4. Register the global error handler (must be last)
//   5. Connect to PostgreSQL (via Prisma) and start listening
//
// Middleware order matters:
//   helmet → cors → morgan → json parser → routes → error handler
// =============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load .env before any module that reads process.env
dotenv.config();

import prisma from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import problemRoutes from './modules/problems/problem.routes';
import submissionRoutes from './modules/submissions/submission.routes';
import reviewRoutes from './modules/reviews/review.routes';
import userRoutes from './modules/users/user.routes';

// =============================================================================
// App Initialization
// =============================================================================

const app = express();
const PORT = process.env.PORT || process.env.BACKEND_PORT || 5000;

// =============================================================================
// Middleware Stack
// =============================================================================

// Security headers (XSS protection, HSTS, content sniffing prevention, etc.)
app.use(helmet());

// CORS — allow frontend origin (default: http://localhost:3000)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true, // Allow cookies/auth headers
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// HTTP request logging — 'dev' format: :method :url :status :response-time ms
app.use(morgan('dev'));

// Parse JSON request bodies (limit: 10MB for code submissions in Phase 4)
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// Health Check
// =============================================================================

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// =============================================================================
// API Routes
// =============================================================================
// All routes are prefixed with /api for clear separation from frontend routes.
// Each module registers its own sub-router.
// =============================================================================

app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);

// =============================================================================
// 404 Handler — Catch unmatched routes
// =============================================================================

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// =============================================================================
// Global Error Handler — Must be registered LAST
// =============================================================================

app.use(errorHandler);

// =============================================================================
// Server Start
// =============================================================================

async function startServer() {
  try {
    // Verify database connectivity before accepting requests
    await prisma.$connect();
    console.log('✅ PostgreSQL connected via Prisma');

    app.listen(PORT as number, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📚 API docs: http://0.0.0.0:${PORT}/api/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown — close Prisma and Redis connections
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export default app;
