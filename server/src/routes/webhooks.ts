import { Router, Request, Response } from 'express';
import { GitHubSyncService } from '../services/githubSyncService.js';

const router = Router();

// GitHub Webhook Ingestion Endpoint
router.post('/github', async (req: Request, res: Response): Promise<void> => {
  const deliveryId = (req.headers['x-github-delivery'] as string) || `del-${Date.now()}`;
  const eventType = req.headers['x-github-event'] as string;
  const signatureHeader = req.headers['x-hub-signature-256'] as string;
  const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

  console.log(`[Er.NEXA Webhook] Received GitHub event: "${eventType}" (Delivery: ${deliveryId})`);

  // Handle GitHub Ping Test Event
  if (eventType === 'ping') {
    res.json({
      success: true,
      message: 'GitHub webhook ping received successfully. Webhook handshake verified.',
      zen: req.body?.zen,
    });
    return;
  }

  if (eventType !== 'push') {
    res.json({
      success: true,
      message: `Ignored unhandled event type "${eventType}". Only "push" events trigger incremental knowledge updates.`,
    });
    return;
  }

  try {
    const result = await GitHubSyncService.processWebhookPushEvent(
      deliveryId,
      req.body,
      rawBody,
      signatureHeader
    );

    res.json(result);
  } catch (err: any) {
    console.error('[Er.NEXA Webhook Error]:', err.message);
    res.status(400).json({
      error: 'Webhook processing failed',
      message: err.message,
    });
  }
});

export default router;

