import { runBatchedProjectIntelligence } from './batchAnalyzer.js';
export type { ProjectFileEntry, AnalysisResult } from './geminiServiceTypes.js';
import type { ProjectFileEntry, AnalysisResult } from './geminiServiceTypes.js';

export async function analyzeProjectWithGemini(
  projectName: string,
  files: ProjectFileEntry[],
  folderStructure: string
): Promise<AnalysisResult> {
  return runBatchedProjectIntelligence(projectName, files, folderStructure);
}
