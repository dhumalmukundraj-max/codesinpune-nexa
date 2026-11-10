import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiClient, isConfigured } from '../config/index.js';

export { geminiClient, isConfigured };

export interface ProjectFileEntry {
  path: string;
  content: string;
  size: number;
  language: string;
}

export interface AnalysisResult {
  summary: {
    introduction: {
      name: string;
      tagline: string;
      description: string;
      primaryLanguages: string[];
      frameworks: string[];
      architectureStyle: string;
      verifiedFacts: string[];
      aiInferences: string[];
      unknowns: string[];
    };
    decisions: Array<{
      topic: string;
      decision: string;
      evidenceFile?: string;
      status: 'verified' | 'inferred' | 'unknown';
    }>;
    technicalDocumentation: {
      setupInstructions: string[];
      environmentVariables: Array<{ key: string; description: string; required: boolean }>;
      scripts: Array<{ command: string; purpose: string }>;
      apiEndpoints?: Array<{ method: string; path: string; description: string }>;
    };
    existingFunctionalities: Array<{
      title: string;
      description: string;
      filesInvolved: string[];
      status: 'fully_implemented' | 'partially_implemented';
    }>;
    unfinishedTasks: Array<{
      title: string;
      description: string;
      location?: string;
      type: 'TODO' | 'FIXME' | 'STUB' | 'MISSING_FEATURE';
      priority: 'high' | 'medium' | 'low';
    }>;
    dependencies: Array<{
      name: string;
      version?: string;
      category: 'core' | 'ui' | 'backend' | 'dev' | 'database' | 'ai' | 'other';
      purpose: string;
    }>;
    discussionsAndCommunications: {
      foundSources: string[];
      notes: string[];
      hasHistoricalRecords: boolean;
    };
    futurePlansAndActions: string[];
    missingOrContradictoryInformation: string[];
  };
  flowchartMermaid: string;
  blockDiagramMermaid: string;
  roadmap: {
    phases: Array<{
      id: string;
      name: string;
      status: 'completed' | 'in_progress' | 'planned';
      sequenceOrder: number;
      tasks: Array<{
        title: string;
        description: string;
        status: 'completed' | 'in_progress' | 'pending';
        dependencies?: string[];
      }>;
    }>;
    recommendedSequence: string[];
    immediateNextSteps: string[];
  };
  progressMetrics: {
    completionPercentage: number;
    totalTasksIdentified: number;
    completedTasksCount: number;
    partialTasksCount: number;
    pendingTasksCount: number;
    calculationBasis: string;
    problemStatement?: string;
    isProblemStatementSolved?: boolean;
  };
}

