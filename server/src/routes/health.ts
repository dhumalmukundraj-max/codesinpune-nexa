import { Router, Request, Response } from 'express';
import { isConfigured, config } from '../config/index.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    configured: {
      supabase: isConfigured.supabase,
      gemini: isConfigured.gemini,
    },
    details: {
      supabaseUrl: isConfigured.supabase ? config.supabaseUrl : 'Not configured or using placeholder',
      geminiKeySet: isConfigured.gemini,
      serverPort: config.port,
    },
  });
});

export default router;

