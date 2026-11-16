import express from 'express';
import cors from 'cors';
import { config, isConfigured } from './config/index.js';
import healthRouter from './routes/health.js';
import analyzeRouter from './routes/analyze.js';
import projectsRouter from './routes/projects.js';
import assistantRouter from './routes/assistant.js';
import reviewsRouter from './routes/reviews.js';
import syncRouter from './routes/sync.js';
import graphRouter from './routes/graph.js';
import tasksRouter from './routes/tasks.js';
import webhooksRouter from './routes/webhooks.js';
import profilesRouter from './routes/profiles.js';
import messagesRouter from './routes/messages.js';
import handoversRouter from './routes/handovers.js';
import { SchedulerService } from './services/schedulerService.js';

const app = express();

// Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));

// Express JSON parsing with rawBody retention for GitHub Webhook HMAC verification
app.use(express.json({
  limit: '100mb',
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Route bindings
app.use('/api', healthRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects', reviewsRouter); // reviews & permissions under /api/projects/:projectId/...
app.use('/api/projects/:id/sync', syncRouter); // Feature 1: Continuous GitHub Synchronization
app.use('/api/projects/:id/graph', graphRouter); // Feature 2: Interactive Knowledge Graph
app.use('/api/projects/:id/tasks', tasksRouter); // Feature 3: Intelligent Roadmap & Tasks
app.use('/api/webhooks', webhooksRouter); // Feature 1: GitHub Webhooks
app.use('/api/profiles', profilesRouter); // Instagram-style User Profiles
app.use('/api/messages', messagesRouter); // Built-in Real-Time Messenger
app.use('/api/handovers', handoversRouter); // Knowledge Handover Centre
app.use('/api/assistant', assistantRouter);

// Root informational endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Er.NEXA Backend API Engine',
    version: '1.3.0',
    status: 'online',
    endpoints: {
      health: '/api/health',
      analyze: '/api/analyze/run',
      projects: '/api/projects',
      sync: '/api/projects/:id/sync/config',
      graph: '/api/projects/:id/graph',
      tasks: '/api/projects/:id/tasks',
      webhooks: '/api/webhooks/github',
      assistant: '/api/assistant/:projectId/chat',
    },
  });
});

// Centralized error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Er.NEXA Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
});

// Start Server & Background Scheduler
app.listen(config.port, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Er.NEXA Server running on http://localhost:${config.port}`);
  console.log(`⚙️  Supabase Integration: ${isConfigured.supabase ? '✅ Configured' : '⚠️  Pending Config (.env)'}`);
  console.log(`🤖 Google Gemini API:   ${isConfigured.gemini ? '✅ Configured' : '⚠️  Pending Config (.env)'}`);
  console.log(`====================================================`);

  // Initialize scheduled sync job
  SchedulerService.init();
});
