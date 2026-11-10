import express from 'express';
import cors from 'cors';
import { config, isConfigured } from './config/index.js';
import healthRouter from './routes/health.js';
import analyzeRouter from './routes/analyze.js';
import projectsRouter from './routes/projects.js';
import assistantRouter from './routes/assistant.js';
import reviewsRouter from './routes/reviews.js';

const app = express();

// Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Route bindings
app.use('/api', healthRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects', reviewsRouter); // reviews & permissions under /api/projects/:projectId/...
app.use('/api/assistant', assistantRouter);

// Root informational endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Er.NEXA Backend API Engine',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/api/health',
      analyze: '/api/analyze/run',
      projects: '/api/projects',
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

// Start Server
app.listen(config.port, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Er.NEXA Server running on http://localhost:${config.port}`);
  console.log(`⚙️  Supabase Integration: ${isConfigured.supabase ? '✅ Configured' : '⚠️  Pending Config (.env)'}`);
  console.log(`🤖 Google Gemini API:   ${isConfigured.gemini ? '✅ Configured' : '⚠️  Pending Config (.env)'}`);
  console.log(`====================================================`);
});

