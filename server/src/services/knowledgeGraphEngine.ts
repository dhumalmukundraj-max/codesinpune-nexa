import { 
  KnowledgeGraphNode, 
  KnowledgeGraphEdge, 
  KnowledgeGraphData, 
  KnowledgeNodeType, 
  KnowledgeRelationshipType, 
  graphStorage 
} from './storage/graphStorage.js';
import { AnalysisResult } from './geminiServiceTypes.js';

interface RawFileInfo {
  path: string;
  content?: string;
  language?: string;
  size?: number;
}

export class KnowledgeGraphEngine {
  /**
   * Generates a complete Knowledge Graph from project files and analysis
   */
  static generateGraph(
    projectId: string,
    projectName: string,
    files: RawFileInfo[],
    analysis?: AnalysisResult
  ): KnowledgeGraphData {
    const nodes: KnowledgeGraphNode[] = [];
    const edges: KnowledgeGraphEdge[] = [];
    const nodeIds = new Set<string>();

    const addNode = (node: KnowledgeGraphNode) => {
      if (!nodeIds.has(node.id)) {
        nodeIds.add(node.id);
        nodes.push(node);
      }
    };

    const addEdge = (edge: KnowledgeGraphEdge) => {
      if (!nodeIds.has(edge.source_node_id) || !nodeIds.has(edge.target_node_id)) {
        return; // do not add orphaned edge
      }
      const existing = edges.find((e) => e.id === edge.id);
      if (!existing) {
        edges.push(edge);
      }
    };

    // 1. Root Project Node
    const rootId = `proj-${projectId.slice(0, 8)}`;
    addNode({
      id: rootId,
      project_id: projectId,
      label: projectName || 'Software Project',
      node_type: 'project',
      description: analysis?.summary?.introduction?.description || 'Root Software Project Knowledge Model',
      evidence_type: 'verified_code',
      confidence: 1.0,
      position_x: 600,
      position_y: 50,
      metadata: {
        languages: analysis?.summary?.introduction?.primaryLanguages || [],
        frameworks: analysis?.summary?.introduction?.frameworks || [],
        completionPercentage: analysis?.progressMetrics?.completionPercentage || 0,
      },
    });

    const fileNodeMap = new Map<string, string>(); // normalized path -> nodeId

    // 2. Extract Source Files, Components, and Modules
    files.forEach((file) => {
      const normalized = file.path.replace(/\\/g, '/').replace(/^\//, '');
      const fileName = normalized.split('/').pop() || normalized;
      const lowerPath = normalized.toLowerCase();

      // Classify node type based on real project structure
      let nodeType: KnowledgeNodeType = 'source_file';
      if (
        lowerPath.includes('client/src/components') ||
        lowerPath.includes('src/components') ||
        lowerPath.includes('client/src/pages') ||
        lowerPath.includes('src/pages') ||
        fileName.endsWith('.tsx') ||
        fileName.endsWith('.jsx')
      ) {
        nodeType = 'frontend_component';
      } else if (
        lowerPath.includes('server/src/routes') ||
        lowerPath.includes('src/routes') ||
        lowerPath.includes('server/src/services') ||
        lowerPath.includes('src/services') ||
        lowerPath.includes('server/src/middleware') ||
        lowerPath.includes('src/controllers') ||
        lowerPath.includes('backend')
      ) {
        nodeType = 'backend_module';
      } else if (
        lowerPath.includes('schema') ||
        lowerPath.includes('models') ||
        lowerPath.includes('migrations') ||
        fileName.endsWith('.sql')
      ) {
        nodeType = 'database_table';
      }

      const fileNodeId = `file-${Buffer.from(normalized).toString('base64url').slice(0, 16)}`;
      fileNodeMap.set(normalized.toLowerCase(), fileNodeId);

      addNode({
        id: fileNodeId,
        project_id: projectId,
        label: fileName,
        node_type: nodeType,
        file_path: normalized,
        description: `${nodeType.replace('_', ' ').toUpperCase()} (${file.language || 'Code'})`,
        evidence_type: 'verified_code',
        confidence: 0.98,
        metadata: {
          size: file.size,
          language: file.language,
        },
      });

      // Link file to Project
      addEdge({
        id: `edge-${rootId}-${fileNodeId}`,
        project_id: projectId,
        source_node_id: rootId,
        target_node_id: fileNodeId,
        relationship_type: 'belongs_to',
        label: 'contains',
        extraction_method: 'static_analysis',
        evidence: `Discovered in project repository at ${normalized}`,
        confidence: 1.0,
      });
    });

    // 3. Parse Code Contents: Imports, APIs, Database calls, Functions, AI services
    const detectedEndpoints = new Map<string, string>(); // method:path -> endpointNodeId
    const detectedDbTables = new Map<string, string>(); // tableName -> tableNodeId
    const detectedExternalDeps = new Map<string, string>(); // pkgName -> depNodeId

    files.forEach((file) => {
      const normalized = file.path.replace(/\\/g, '/').replace(/^\//, '');
      const fileNodeId = fileNodeMap.get(normalized.toLowerCase());
      if (!fileNodeId || !file.content) return;

      const lines = file.content.split('\n');

      // A. Extract Imports
      lines.forEach((line, lineIdx) => {
        // ES / TS Imports: import { X } from 'path'; or import X from 'path';
        const importMatch = line.match(/(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/);
        if (importMatch) {
          const importPath = importMatch[1] || importMatch[2];
          if (importPath.startsWith('.')) {
            // Local relative import
            const targetPath = resolveRelativePath(normalized, importPath);
            const targetNodeId = fileNodeMap.get(targetPath.toLowerCase());
            if (targetNodeId && targetNodeId !== fileNodeId) {
              addEdge({
                id: `edge-${fileNodeId}-imp-${targetNodeId}`,
                project_id: projectId,
                source_node_id: fileNodeId,
                target_node_id: targetNodeId,
                relationship_type: 'imports',
                label: 'imports',
                evidence: line.trim(),
                evidence_file: normalized,
                evidence_line: lineIdx + 1,
                extraction_method: 'static_analysis',
                confidence: 0.95,
              });
            }
          } else {
            // External package import
            const pkgName = importPath.startsWith('@')
              ? importPath.split('/').slice(0, 2).join('/')
              : importPath.split('/')[0];

            if (pkgName && !pkgName.startsWith('node:')) {
              let depNodeId = detectedExternalDeps.get(pkgName);
              const isAiService = ['@google/generative-ai', 'openai', 'anthropic', '@langchain/core'].includes(pkgName);

              if (!depNodeId) {
                depNodeId = `dep-${Buffer.from(pkgName).toString('base64url').slice(0, 12)}`;
                detectedExternalDeps.set(pkgName, depNodeId);

                addNode({
                  id: depNodeId,
                  project_id: projectId,
                  label: pkgName,
                  node_type: isAiService ? 'ai_service' : 'external_dependency',
                  description: isAiService ? 'AI Reasoning & LLM Backend Service' : 'Third-party Dependency Package',
                  evidence_type: 'verified_code',
                  confidence: 1.0,
                  metadata: { packageName: pkgName },
                });
              }

              addEdge({
                id: `edge-${fileNodeId}-dep-${depNodeId}`,
                project_id: projectId,
                source_node_id: fileNodeId,
                target_node_id: depNodeId,
                relationship_type: isAiService ? 'calls' : 'depends_on',
                label: isAiService ? 'calls AI' : 'depends on',
                evidence: line.trim(),
                evidence_file: normalized,
                evidence_line: lineIdx + 1,
                extraction_method: 'static_analysis',
                confidence: 0.95,
              });
            }
          }
        }

        // B. Extract API Endpoints Defined in Backend (Express: router.get('/path'), app.post('/path'))
        const routeDefMatch = line.match(/(?:router|app)\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/i);
        if (routeDefMatch) {
          const method = routeDefMatch[1].toUpperCase();
          const routePath = routeDefMatch[2];
          const fullEndpoint = `${method} ${routePath}`;

          let endpointNodeId = detectedEndpoints.get(fullEndpoint);
          if (!endpointNodeId) {
            endpointNodeId = `api-${Buffer.from(fullEndpoint).toString('base64url').slice(0, 14)}`;
            detectedEndpoints.set(fullEndpoint, endpointNodeId);

            addNode({
              id: endpointNodeId,
              project_id: projectId,
              label: fullEndpoint,
              node_type: 'api_endpoint',
              description: `HTTP API Endpoint [${method}]`,
              evidence_type: 'verified_code',
              confidence: 0.98,
              metadata: { method, path: routePath },
            });
          }

          addEdge({
            id: `edge-${fileNodeId}-impl-${endpointNodeId}`,
            project_id: projectId,
            source_node_id: fileNodeId,
            target_node_id: endpointNodeId,
            relationship_type: 'implements',
            label: 'implements',
            evidence: line.trim(),
            evidence_file: normalized,
            evidence_line: lineIdx + 1,
            extraction_method: 'static_analysis',
            confidence: 0.98,
          });
        }

        // C. Extract API Client Invocations (fetch('/api/...'), axios.get('/api/...'))
        const clientCallMatch = line.match(/(?:fetch|axios\.(?:get|post|put|delete))\(\s*[`'"](\/api\/[^`'"]+)[`'"]/);
        if (clientCallMatch) {
          const calledPath = clientCallMatch[1].split('?')[0];
          // Find matching endpoint
          for (const [endpointStr, epId] of detectedEndpoints.entries()) {
            if (endpointStr.includes(calledPath)) {
              addEdge({
                id: `edge-${fileNodeId}-uses-${epId}`,
                project_id: projectId,
                source_node_id: fileNodeId,
                target_node_id: epId,
                relationship_type: 'uses_api',
                label: 'uses API',
                evidence: line.trim(),
                evidence_file: normalized,
                evidence_line: lineIdx + 1,
                extraction_method: 'static_analysis',
                confidence: 0.9,
              });
            }
          }
        }

        // D. Extract Database Table References (e.g. supabase.from('projects'), prisma.project, FROM "projects")
        const dbTableMatch = line.match(/(?:supabase\.from|from)\(\s*['"]([a-zA-Z0-9_]+)['"]\)|(?:FROM|INTO|UPDATE)\s+["']?([a-zA-Z0-9_]+)["']?/i);
        if (dbTableMatch) {
          const tableName = dbTableMatch[1] || dbTableMatch[2];
          const commonSqlKeywords = new Set(['select', 'where', 'join', 'left', 'right', 'inner', 'outer', 'set', 'table']);
          if (tableName && !commonSqlKeywords.has(tableName.toLowerCase()) && tableName.length > 2) {
            let tableNodeId = detectedDbTables.get(tableName.toLowerCase());
            if (!tableNodeId) {
              tableNodeId = `db-${Buffer.from(tableName.toLowerCase()).toString('base64url').slice(0, 12)}`;
              detectedDbTables.set(tableName.toLowerCase(), tableNodeId);

              addNode({
                id: tableNodeId,
                project_id: projectId,
                label: `DB: ${tableName}`,
                node_type: 'database_table',
                description: `Database Table / Entity Model "${tableName}"`,
                evidence_type: 'verified_code',
                confidence: 0.95,
                metadata: { tableName },
              });
            }

            const isWrite = line.toLowerCase().includes('insert') || line.toLowerCase().includes('update') || line.toLowerCase().includes('delete') || line.toLowerCase().includes('upsert');
            addEdge({
              id: `edge-${fileNodeId}-db-${tableNodeId}-${lineIdx}`,
              project_id: projectId,
              source_node_id: fileNodeId,
              target_node_id: tableNodeId,
              relationship_type: isWrite ? 'writes_to' : 'reads_from',
              label: isWrite ? 'writes to' : 'reads from',
              evidence: line.trim(),
              evidence_file: normalized,
              evidence_line: lineIdx + 1,
              extraction_method: 'static_analysis',
              confidence: 0.92,
            });
          }
        }

        // E. Extract Exported Functions / Classes (limit to top important ones per file)
        const exportFnMatch = line.match(/^export\s+(?:async\s+)?(?:function|class|const)\s+([a-zA-Z0-9_]+)/);
        if (exportFnMatch && exportFnMatch[1] && !exportFnMatch[1].startsWith('_')) {
          const fnName = exportFnMatch[1];
          const fnNodeId = `fn-${fileNodeId}-${fnName}`;
          const symbolBaseName = normalized.split('/').pop() || normalized;
          addNode({
            id: fnNodeId,
            project_id: projectId,
            label: fnName,
            node_type: 'function_class',
            file_path: normalized,
            description: `Exported Symbol in ${symbolBaseName}`,
            evidence_type: 'verified_code',
            confidence: 0.95,
          });

          addEdge({
            id: `edge-${fileNodeId}-exp-${fnNodeId}`,
            project_id: projectId,
            source_node_id: fileNodeId,
            target_node_id: fnNodeId,
            relationship_type: 'exports',
            label: 'exports',
            evidence: line.trim(),
            evidence_file: normalized,
            evidence_line: lineIdx + 1,
            extraction_method: 'static_analysis',
            confidence: 0.95,
          });
        }
      });
    });

    // 4. Incorporate Architectural Decisions from Gemini Analysis
    if (analysis?.summary?.decisions) {
      analysis.summary.decisions.forEach((dec, idx) => {
        const decNodeId = `arch-dec-${idx}`;
        addNode({
          id: decNodeId,
          project_id: projectId,
          label: dec.topic,
          node_type: 'architectural_decision',
          description: dec.decision,
          evidence_type: dec.status === 'verified' ? 'verified_code' : 'ai_inferred',
          confidence: dec.status === 'verified' ? 0.95 : 0.75,
          metadata: { status: dec.status, topic: dec.topic },
        });

        if (dec.evidenceFile) {
          const targetFileNodeId = fileNodeMap.get(dec.evidenceFile.toLowerCase());
          if (targetFileNodeId) {
            addEdge({
              id: `edge-${decNodeId}-rel-${targetFileNodeId}`,
              project_id: projectId,
              source_node_id: decNodeId,
              target_node_id: targetFileNodeId,
              relationship_type: 'architectural_relationship',
              label: 'governs',
              evidence: `Decision grounded in evidence file ${dec.evidenceFile}`,
              evidence_file: dec.evidenceFile,
              extraction_method: 'ai_inferred',
              confidence: 0.85,
            });
          }
        }
      });
    }

    // 5. Compute Clean Hierarchical Visual Positions for @xyflow/react
    computeGraphLayout(nodes);

    return {
      nodes,
      edges,
      version: 1,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Normalizes and computes layered coordinates for XYFlow
 */
function computeGraphLayout(nodes: KnowledgeGraphNode[]) {
  const layerOrder: Record<KnowledgeNodeType, { y: number; colSpacing: number }> = {
    project: { y: 60, colSpacing: 280 },
    architectural_decision: { y: 160, colSpacing: 260 },
    frontend_component: { y: 280, colSpacing: 220 },
    api_endpoint: { y: 440, colSpacing: 240 },
    backend_module: { y: 600, colSpacing: 220 },
    function_class: { y: 740, colSpacing: 200 },
    database_table: { y: 880, colSpacing: 240 },
    ai_service: { y: 1020, colSpacing: 260 },
    external_dependency: { y: 1140, colSpacing: 180 },
    source_file: { y: 1260, colSpacing: 200 },
  };

  const layerCounters: Record<string, number> = {};

  nodes.forEach((node) => {
    const layout = layerOrder[node.node_type] || { y: 500, colSpacing: 220 };
    const colIndex = layerCounters[node.node_type] || 0;
    layerCounters[node.node_type] = colIndex + 1;

    // Centered horizontal alignment
    const x = 120 + colIndex * layout.colSpacing;
    node.position_x = x;
    node.position_y = layout.y;
  });
}

function resolveRelativePath(currentFilePath: string, relativeImport: string): string {
  const currentDirParts = currentFilePath.split('/').slice(0, -1);
  const importParts = relativeImport.split('/');

  for (const part of importParts) {
    if (part === '.') continue;
    if (part === '..') {
      currentDirParts.pop();
    } else {
      currentDirParts.push(part);
    }
  }

  let resolved = currentDirParts.join('/');
  // Strip extension matching if imported without ext
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  for (const ext of extensions) {
    if (resolved.endsWith(ext)) {
      resolved = resolved.slice(0, -ext.length);
      break;
    }
  }
  return resolved;
}
