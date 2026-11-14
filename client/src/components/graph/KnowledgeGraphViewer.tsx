import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  Node,
  Edge,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Search,
  RefreshCw,
  SlidersHorizontal,
  X,
  FileCode,
  Layout,
  Server,
  Database,
  Globe,
  Layers,
  Cpu,
  BookmarkCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Info,
  Maximize2
} from 'lucide-react';
import { fetchKnowledgeGraph, generateKnowledgeGraph } from '../../lib/api';
import { KnowledgeGraphData, KnowledgeGraphNode, KnowledgeGraphEdge, KnowledgeNodeType } from '../../types';

interface KnowledgeGraphViewerProps {
  projectId: string;
  projectName: string;
}

// Icon and color map for 10 node types
const NODE_STYLE_MAP: Record<KnowledgeNodeType, { label: string; bg: string; border: string; text: string; icon: any }> = {
  project: { label: 'Project Root', bg: '#FFF6E8', border: '#C1121F', text: '#1C1917', icon: Layers },
  frontend_component: { label: 'Frontend Component', bg: '#EFF6FF', border: '#3B82F6', text: '#1E3A8A', icon: Layout },
  backend_module: { label: 'Backend Module', bg: '#F5F3FF', border: '#8B5CF6', text: '#4C1D95', icon: Server },
  source_file: { label: 'Source File', bg: '#F8FAFC', border: '#64748B', text: '#0F172A', icon: FileCode },
  function_class: { label: 'Function / Class', bg: '#ECFDF5', border: '#10B981', text: '#064E3B', icon: Cpu },
  api_endpoint: { label: 'API Endpoint', bg: '#FEF3C7', border: '#F59E0B', text: '#78350F', icon: Globe },
  database_table: { label: 'Database Model', bg: '#FDF2F8', border: '#EC4899', text: '#831843', icon: Database },
  external_dependency: { label: 'External Package', bg: '#F3F4F6', border: '#9CA3AF', text: '#374151', icon: Layers },
  ai_service: { label: 'AI Service', bg: '#FDF4FF', border: '#D946EF', text: '#701A75', icon: Sparkles },
  architectural_decision: { label: 'Architecture Decision', bg: '#FFFBEB', border: '#D97706', text: '#78350F', icon: BookmarkCheck },
};

// Custom ReactFlow Node Component
const CustomGraphNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = (data as unknown) as KnowledgeGraphNode;
  const config = NODE_STYLE_MAP[nodeData.node_type] || NODE_STYLE_MAP.source_file;
  const Icon = config.icon;

  const isVerified = nodeData.evidence_type === 'verified_code';

  return (
    <div
      className={`group relative rounded-xl px-3.5 py-2.5 shadow-sm transition-all border-2 min-w-[170px] max-w-[260px] ${
        selected ? 'ring-4 ring-[#C1121F]/30 scale-105 z-30 shadow-lg' : 'hover:shadow-md'
      }`}
      style={{
        backgroundColor: config.bg,
        borderColor: selected ? '#C1121F' : config.border,
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-stone-500 !border-white" />
      
      <div className="flex items-start gap-2">
        <div
          className="p-1 rounded-lg shrink-0 mt-0.5"
          style={{ backgroundColor: `${config.border}20`, color: config.border }}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] uppercase tracking-wider font-bold truncate"
              style={{ color: config.border }}
            >
              {config.label}
            </span>
            {isVerified ? (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Verified Code Fact" />
            ) : (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="AI Inferred Fact" />
            )}
          </div>
          <p className="text-xs font-bold text-stone-900 truncate mt-0.5" title={nodeData.label}>
            {nodeData.label}
          </p>
          {nodeData.file_path && (
            <p className="text-[10px] font-mono text-stone-500 truncate" title={nodeData.file_path}>
              {nodeData.file_path.split('/').pop()}
            </p>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-stone-500 !border-white" />
    </div>
  );
};

const nodeTypes = {
  customNode: CustomGraphNode,
};

export const KnowledgeGraphViewer: React.FC<KnowledgeGraphViewerProps> = ({ projectId, projectName }) => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData>({ nodes: [], edges: [] });
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<any>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeNodeDetails, setActiveNodeDetails] = useState<KnowledgeGraphNode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Knowledge Graph
  const loadGraph = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchKnowledgeGraph(projectId);
      if (res.graph) {
        setGraphData(res.graph);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load knowledge graph.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, [projectId]);

  // Handle Regenerate Graph
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setErrorMessage(null);
    try {
      const res = await generateKnowledgeGraph(projectId);
      if (res.graph) {
        setGraphData(res.graph);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to regenerate knowledge graph.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Filtered and transformed ReactFlow nodes and edges
  useEffect(() => {
    if (!graphData.nodes) return;

    // Filter nodes by category and search
    const filteredRawNodes = graphData.nodes.filter((node) => {
      // Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'frontend' && node.node_type !== 'frontend_component') return false;
        if (categoryFilter === 'backend' && node.node_type !== 'backend_module') return false;
        if (categoryFilter === 'database' && node.node_type !== 'database_table') return false;
        if (categoryFilter === 'api' && node.node_type !== 'api_endpoint') return false;
        if (categoryFilter === 'dependencies' && node.node_type !== 'external_dependency') return false;
        if (categoryFilter === 'architecture' && node.node_type !== 'architectural_decision') return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLabel = node.label.toLowerCase().includes(q);
        const matchPath = (node.file_path || '').toLowerCase().includes(q);
        const matchDesc = (node.description || '').toLowerCase().includes(q);
        if (!matchLabel && !matchPath && !matchDesc) return false;
      }

      return true;
    });

    const activeNodeIdSet = new Set(filteredRawNodes.map((n) => n.id));

    // Connected Node IDs for highlighting if a node is selected
    const highlightedNodeIds = new Set<string>();
    const highlightedEdgeIds = new Set<string>();

    if (selectedNodeId) {
      highlightedNodeIds.add(selectedNodeId);
      graphData.edges.forEach((edge) => {
        if (edge.source_node_id === selectedNodeId) {
          highlightedNodeIds.add(edge.target_node_id);
          highlightedEdgeIds.add(edge.id);
        }
        if (edge.target_node_id === selectedNodeId) {
          highlightedNodeIds.add(edge.source_node_id);
          highlightedEdgeIds.add(edge.id);
        }
      });
    }

    // Map to ReactFlow Nodes
    const rfNodes: Node<any>[] = filteredRawNodes.map((node) => {
      const isSelected = selectedNodeId === node.id;
      const isHighlighted = !selectedNodeId || highlightedNodeIds.has(node.id);

      return {
        id: node.id,
        type: 'customNode',
        position: node.position || { x: 100, y: 100 },
        data: node,
        selected: isSelected,
        style: {
          opacity: isHighlighted ? 1 : 0.25,
          transition: 'all 0.2s ease',
        },
      };
    });

    // Map to ReactFlow Edges
    const rfEdges: Edge[] = graphData.edges
      .filter((edge) => activeNodeIdSet.has(edge.source_node_id) && activeNodeIdSet.has(edge.target_node_id))
      .map((edge) => {
        const isHighlighted = !selectedNodeId || highlightedEdgeIds.has(edge.id);
        return {
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          label: edge.label || edge.relationship_type.replace('_', ' '),
          type: 'smoothstep',
          animated: edge.extraction_method === 'ai_inference',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: isHighlighted ? (selectedNodeId ? '#C1121F' : '#64748B') : '#CBD5E1',
          },
          style: {
            stroke: isHighlighted ? (selectedNodeId ? '#C1121F' : '#64748B') : '#E2E8F0',
            strokeWidth: isHighlighted && selectedNodeId ? 2.5 : 1.5,
            opacity: isHighlighted ? 1 : 0.2,
          },
          labelStyle: {
            fontSize: 9,
            fill: '#475569',
            fontFamily: 'monospace',
            fontWeight: 500,
          },
          labelBgStyle: {
            fill: '#FFFFFF',
            fillOpacity: 0.9,
          },
        };
      });

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [graphData, categoryFilter, searchQuery, selectedNodeId]);

  // Handle Node Click
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (selectedNodeId === node.id) {
        setSelectedNodeId(null);
        setActiveNodeDetails(null);
      } else {
        setSelectedNodeId(node.id);
        const detail = graphData.nodes.find((n) => n.id === node.id) || null;
        setActiveNodeDetails(detail);
      }
    },
    [selectedNodeId, graphData.nodes]
  );

  // Incoming and outgoing connections for drawer
  const connections = useMemo(() => {
    if (!activeNodeDetails) return { incoming: [], outgoing: [] };
    const incoming = graphData.edges
      .filter((e) => e.target_node_id === activeNodeDetails.id)
      .map((e) => ({
        edge: e,
        sourceNode: graphData.nodes.find((n) => n.id === e.source_node_id),
      }));
    const outgoing = graphData.edges
      .filter((e) => e.source_node_id === activeNodeDetails.id)
      .map((e) => ({
        edge: e,
        targetNode: graphData.nodes.find((n) => n.id === e.target_node_id),
      }));
    return { incoming, outgoing };
  }, [activeNodeDetails, graphData]);

  if (isLoading && graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <RefreshCw className="w-8 h-8 text-[#C1121F] animate-spin mb-3" />
        <p className="text-stone-700 font-semibold">Constructing Project Knowledge Graph...</p>
        <p className="text-xs text-stone-500 mt-1">Analyzing static code AST, imports, endpoints, and architectural relationships.</p>
      </div>
    );
  }

  const categoryPills = [
    { id: 'all', label: 'All Components' },
    { id: 'frontend', label: 'Frontend' },
    { id: 'backend', label: 'Backend' },
    { id: 'api', label: 'API Endpoints' },
    { id: 'database', label: 'Database' },
    { id: 'dependencies', label: 'Dependencies' },
    { id: 'architecture', label: 'Architecture' },
  ];

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search components, files, symbols, endpoints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:bg-white focus:ring-2 focus:ring-[#C1121F]/20 focus:border-[#C1121F] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* Graph Stats & Regenerate Button */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
              <span className="bg-stone-100 px-2 py-1 rounded text-stone-700 font-mono">
                {nodes.length} Nodes
              </span>
              <span className="bg-stone-100 px-2 py-1 rounded text-stone-700 font-mono">
                {edges.length} Edges
              </span>
            </div>

            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-stone-200 hover:border-[#C1121F] text-stone-700 hover:text-[#C1121F] rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
              title="Regenerate knowledge graph from current files"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? 'Extracting...' : 'Regenerate Graph'}
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider mr-1 shrink-0">Filter:</span>
          {categoryPills.map((pill) => (
            <button
              key={pill.id}
              onClick={() => setCategoryFilter(pill.id)}
              className={`px-3 py-1 text-xs rounded-full whitespace-nowrap font-medium transition-all ${
                categoryFilter === pill.id
                  ? 'bg-[#C1121F] text-white shadow-sm'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas & Detail Drawer Container */}
      <div className="relative w-full h-[620px] bg-stone-50 border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          minZoom={0.2}
          maxZoom={2.0}
        >
          <Background color="#D6D3D1" gap={18} size={1} />
          <Controls className="!bg-white !border !border-stone-200 !rounded-xl !shadow-sm !overflow-hidden" />
          <MiniMap
            nodeColor={(n: any) => {
              const nodeData = n.data as KnowledgeGraphNode;
              return NODE_STYLE_MAP[nodeData.node_type]?.border || '#C1121F';
            }}
            maskColor="rgba(240, 240, 240, 0.7)"
            className="!bg-white !border !border-stone-200 !rounded-xl !shadow-sm !overflow-hidden"
          />
        </ReactFlow>

        {/* Helper Badge */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur border border-stone-200 rounded-xl px-3 py-1.5 text-[11px] text-stone-600 shadow-sm pointer-events-none hidden sm:flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Verified Fact
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> AI Inferred
          </span>
          <span>•</span>
          <span>Click any node to inspect upstream/downstream connections</span>
        </div>

        {/* Slide-over Node Detail Drawer */}
        {activeNodeDetails && (
          <div className="absolute top-0 right-0 h-full w-full sm:w-96 bg-white border-l border-stone-200 shadow-xl z-20 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-stone-100 flex items-start justify-between gap-3">
              <div>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider"
                  style={{
                    backgroundColor: `${NODE_STYLE_MAP[activeNodeDetails.node_type]?.border}15`,
                    color: NODE_STYLE_MAP[activeNodeDetails.node_type]?.border,
                  }}
                >
                  {NODE_STYLE_MAP[activeNodeDetails.node_type]?.label || activeNodeDetails.node_type}
                </span>
                <h3 className="text-base font-bold text-stone-900 mt-1 truncate" title={activeNodeDetails.label}>
                  {activeNodeDetails.label}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedNodeId(null);
                  setActiveNodeDetails(null);
                }}
                className="p-1 hover:bg-stone-100 text-stone-400 hover:text-stone-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Details */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Evidence & Confidence Badge */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
                    Verification Status
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full ${
                      activeNodeDetails.evidence_type === 'verified_code'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {activeNodeDetails.evidence_type === 'verified_code' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Static Code Verified
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-amber-600" /> AI Semantic Inference
                      </>
                    )}
                  </span>
                </div>
                {activeNodeDetails.confidence !== undefined && (
                  <div className="flex items-center justify-between text-stone-600">
                    <span>Confidence Score</span>
                    <span className="font-mono font-bold">{Math.round(activeNodeDetails.confidence * 100)}%</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {activeNodeDetails.description && (
                <div>
                  <p className="font-semibold text-stone-700 uppercase tracking-wider text-[10px] mb-1">Description</p>
                  <p className="text-stone-600 leading-relaxed bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                    {activeNodeDetails.description}
                  </p>
                </div>
              )}

              {/* File Reference */}
              {activeNodeDetails.file_path && (
                <div>
                  <p className="font-semibold text-stone-700 uppercase tracking-wider text-[10px] mb-1">Source File</p>
                  <div className="p-2.5 bg-stone-900 text-stone-200 rounded-xl font-mono text-[11px] break-all">
                    {activeNodeDetails.file_path}
                    {activeNodeDetails.line_number && (
                      <span className="text-amber-400 ml-1">:L{activeNodeDetails.line_number}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Outgoing Dependencies */}
              <div>
                <p className="font-semibold text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                  Depends On / Calls ({connections.outgoing.length})
                </p>
                {connections.outgoing.length === 0 ? (
                  <p className="text-stone-400 italic">No outgoing connections.</p>
                ) : (
                  <div className="space-y-1.5">
                    {connections.outgoing.map((conn, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                        onClick={() => conn.targetNode && setActiveNodeDetails(conn.targetNode)}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-stone-800 truncate">{conn.targetNode?.label || 'Node'}</p>
                          <p className="text-[10px] text-stone-500 font-mono">
                            {conn.edge.label || conn.edge.relationship_type}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Incoming Dependencies */}
              <div>
                <p className="font-semibold text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                  Referenced By / Imported By ({connections.incoming.length})
                </p>
                {connections.incoming.length === 0 ? (
                  <p className="text-stone-400 italic">No incoming references.</p>
                ) : (
                  <div className="space-y-1.5">
                    {connections.incoming.map((conn, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                        onClick={() => conn.sourceNode && setActiveNodeDetails(conn.sourceNode)}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-stone-800 truncate">{conn.sourceNode?.label || 'Node'}</p>
                          <p className="text-[10px] text-stone-500 font-mono">
                            {conn.edge.label || conn.edge.relationship_type}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
