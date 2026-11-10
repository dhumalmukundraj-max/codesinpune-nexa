import { geminiClient, isConfigured } from './geminiServiceTypes.js';
import { config } from '../config/index.js';

export interface GenerateWithResilienceOptions {
  prompt: string;
  responseMimeType?: string;
  temperature?: number;
  label?: string;
  primaryModel?: string;
}

// Fallback chain in priority order
const DEFAULT_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-pro-latest',
];

function isRetryableError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const status = err.status || 0;

  if (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  ) {
    return true;
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cleanJsonResponseText(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Executes a Gemini content generation request with automatic exponential backoff
 * retries and seamless model fallback if Google's servers return 503 or 429.
 */
export async function generateContentWithResilience(
  options: GenerateWithResilienceOptions
): Promise<string> {
  if (!isConfigured.gemini || !geminiClient) {
    throw new Error('Google Gemini API is not configured. Please supply a valid GEMINI_API_KEY in .env.');
  }

  const primary = options.primaryModel || config.geminiModel || 'gemini-2.5-flash';

  // Build model priority list without duplicates
  const candidateModels = Array.from(new Set([primary, ...DEFAULT_FALLBACK_MODELS]));

  let lastError: any = null;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const currentModel = candidateModels[mIdx];
    const maxRetriesForModel = 2; // Up to 2 retries per model

    for (let attempt = 1; attempt <= maxRetriesForModel; attempt++) {
      try {
        const genModel = geminiClient.getGenerativeModel({
          model: currentModel,
          generationConfig: {
            temperature: options.temperature ?? 0.2,
            ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
          },
        });

        const result = await genModel.generateContent(options.prompt);
        const text = result.response.text();
        if (text && text.length > 0) {
          if (mIdx > 0) {
            console.log(`[Er.NEXA Resilient AI] Successfully synthesized using fallback model "${currentModel}"`);
          }
          return text;
        }
      } catch (err: any) {
        lastError = err;
        const retryable = isRetryableError(err);
        const label = options.label || 'Gemini Request';

        console.warn(
          `[Er.NEXA AI Notice] ${label} on model "${currentModel}" (Attempt ${attempt}/${maxRetriesForModel}): ${err.message || err}`
        );

        // If error indicates model is not found (404), fall back to next model immediately without retrying the dead model
        if ((err.message || '').includes('404')) {
          console.warn(`[Er.NEXA Model Fallback] Model "${currentModel}" not available (404). Falling back to next candidate...`);
          break;
        }

        if (!retryable) {
          // If non-retryable (e.g. fatal prompt error), throw immediately
          throw err;
        }

        // If retryable and retries remain, back off with jitter
        if (attempt < maxRetriesForModel) {
          const backoffMs = attempt * 1800 + Math.floor(Math.random() * 500);
          console.log(`[Er.NEXA Auto-Retry] High demand detected. Retrying in ${(backoffMs / 1000).toFixed(1)}s...`);
          await delay(backoffMs);
        }
      }
    }

    // Model exhausted retries, proceed to next fallback model if available
    if (mIdx < candidateModels.length - 1) {
      const nextModel = candidateModels[mIdx + 1];
      console.log(`[Er.NEXA Model Fallback] High demand on "${currentModel}". Automatically switching to fallback model "${nextModel}"...`);
      await delay(1000);
    }
  }

  throw new Error(
    `Gemini API is currently experiencing extreme traffic across all candidate models (${candidateModels.join(', ')}). Please retry in a moment. [Details: ${lastError?.message || 'Service Unavailable'}]`
  );
}

