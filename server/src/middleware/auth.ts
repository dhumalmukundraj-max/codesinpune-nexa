import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, isConfigured } from '../config/index.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header with Bearer token.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!isConfigured.supabase || !supabaseAdmin) {
    res.status(503).json({
      error: 'Supabase Not Configured',
      message: 'Supabase URL or keys are not configured in .env. Please update .env and configure Supabase.',
    });
    return;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({
        error: 'Invalid Token',
        message: error?.message || 'Failed to authenticate user token.',
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
    };
    next();
  } catch (err: any) {
    res.status(500).json({
      error: 'Authentication Error',
      message: err.message || 'An error occurred during authentication verification.',
    });
  }
}

// Optional Auth (for endpoints that can operate publicly or with user context)
export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ') && isConfigured.supabase && supabaseAdmin) {
    const token = authHeader.split(' ')[1];
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        req.user = { id: user.id, email: user.email };
      }
    } catch {
      // ignore in optional auth
    }
  }
  next();
}

