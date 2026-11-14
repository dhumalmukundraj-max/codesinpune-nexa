import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../../server/data/round3');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getLocalGraphPath(projectId: string): string {
  ensureDataDir();
  return path.join(DATA_DIR, `graph_${projectId}.json`);
}

export type KnowledgeNodeType =
  | 'project'
  | 'frontend_component'
  | 'backend_module'
  | 'source_file'
  | 'function_class'
  | 'api_endpoint'
  | 'database_table'
  | 'external_dependency'
  | 'ai_service'
  | 'architectural_decision';

export type KnowledgeRelationshipType =
  | 'imports'
  | 'exports'
  | 'calls'
  | 'depends_on'
  | 'connects_to'
  | 'reads_from'
  | 'writes_to'
  | 'uses_api'
  | 'implements'
  | 'belongs_to'
  | 'architectural_relationship';

export interface KnowledgeGraphNode {
  id: string;
  project_id: string;
  label: string;
  node_type: KnowledgeNodeType;
  file_path?: string;
  description?: string;
  metadata?: Record<string, any>;
  evidence_type?: 'verified_code' | 'ai_inferred' | 'conceptual';
  confidence?: number;
  position_x?: number;
  position_y?: number;
}

export interface KnowledgeGraphEdge {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: KnowledgeRelationshipType;
  label?: string;
  evidence?: string;
  evidence_file?: string;
  evidence_line?: number;
  extraction_method?: 'static_analysis' | 'ast_parser' | 'ai_inferred';
  confidence?: number;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  version?: number;
  lastUpdated?: string;
}

export const graphStorage = {
  async getGraph(projectId: string): Promise<KnowledgeGraphData> {
    if (supabaseAdmin) {
      try {
        const [nodesRes, edgesRes] = await Promise.all([
          supabaseAdmin.from('knowledge_graph_nodes').select('*').eq('project_id', projectId),
          supabaseAdmin.from('knowledge_graph_edges').select('*').eq('project_id', projectId),
        ]);

        if (!nodesRes.error && !edgesRes.error && nodesRes.data && nodesRes.data.length > 0) {
          return {
            nodes: nodesRes.data as KnowledgeGraphNode[],
            edges: (edgesRes.data || []) as KnowledgeGraphEdge[],
            lastUpdated: new Date().toISOString(),
          };
        }
      } catch {}
    }

    const localFile = getLocalGraphPath(projectId);
    if (fs.existsSync(localFile)) {
      try {
        return JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      } catch {}
    }

    return { nodes: [], edges: [] };
  },

  async saveGraph(projectId: string, data: KnowledgeGraphData): Promise<KnowledgeGraphData> {
    const payload: KnowledgeGraphData = {
      nodes: data.nodes.map((n) => ({ ...n, project_id: projectId })),
      edges: data.edges.map((e) => ({ ...e, project_id: projectId })),
      lastUpdated: new Date().toISOString(),
    };

    if (supabaseAdmin) {
      try {
        // Clean and replace for fresh graph sync
        await supabaseAdmin.from('knowledge_graph_edges').delete().eq('project_id', projectId);
        await supabaseAdmin.from('knowledge_graph_nodes').delete().eq('project_id', projectId);

        if (payload.nodes.length > 0) {
          // Batch insert nodes
          const chunkSize = 100;
          for (let i = 0; i < payload.nodes.length; i += chunkSize) {
            await supabaseAdmin.from('knowledge_graph_nodes').insert(payload.nodes.slice(i, i + chunkSize));
          }
        }

        if (payload.edges.length > 0) {
          const chunkSize = 100;
          for (let i = 0; i < payload.edges.length; i += chunkSize) {
            await supabaseAdmin.from('knowledge_graph_edges').insert(payload.edges.slice(i, i + chunkSize));
          }
        }
      } catch {}
    }

    fs.writeFileSync(getLocalGraphPath(projectId), JSON.stringify(payload, null, 2));
    return payload;
  },

  async updateIncrementalGraph(
    projectId: string,
    removedFilePaths: string[],
    newNodes: KnowledgeGraphNode[],
    newEdges: KnowledgeGraphEdge[]
  ): Promise<KnowledgeGraphData> {
    const existing = await this.getGraph(projectId);

    // Filter out nodes and edges associated with removed files
    const removedSet = new Set(removedFilePaths.map((p) => p.toLowerCase()));
    let updatedNodes = existing.nodes.filter(
      (n) => !n.file_path || !removedSet.has(n.file_path.toLowerCase())
    );

    const validNodeIdSet = new Set(updatedNodes.map((n) => n.id));

    // Remove existing nodes that will be replaced by newNodes
    const newNodeIdSet = new Set(newNodes.map((n) => n.id));
    updatedNodes = updatedNodes.filter((n) => !newNodeIdSet.has(n.id));
    updatedNodes.push(...newNodes);

    // Update nodeIdSet
    const allNodeIds = new Set(updatedNodes.map((n) => n.id));

    // Filter existing edges
    let updatedEdges = existing.edges.filter(
      (e) =>
        allNodeIds.has(e.source_node_id) &&
        allNodeIds.has(e.target_node_id) &&
        (!e.evidence_file || !removedSet.has(e.evidence_file.toLowerCase()))
    );

    // Add new edges if both ends exist
    const newEdgeIdSet = new Set(newEdges.map((e) => e.id));
    updatedEdges = updatedEdges.filter((e) => !newEdgeIdSet.has(e.id));
    for (const edge of newEdges) {
      if (allNodeIds.has(edge.source_node_id) && allNodeIds.has(edge.target_node_id)) {
        updatedEdges.push(edge);
      }
    }

    return this.saveGraph(projectId, {
      nodes: updatedNodes,
      edges: updatedEdges,
    });
  },
};

