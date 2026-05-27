'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────

type PolicyNodeType =
  | 'input' | 'filter' | 'confidence_assigner' | 'multiplier'
  | 'dormancy_multiplier' | 'cap' | 'weighted_sum' | 'output';

type CanvasNodeType =
  // Logic
  | 'If' | 'And' | 'Or' | 'Not'
  // State
  | 'ReadStorage' | 'WriteStorage'
  // Arithmetic
  | 'Add' | 'Subtract' | 'Multiply' | 'Divide'
  // Control Flow
  | 'Start' | 'End'
  // Crypto
  | 'VerifySignature' | 'DecodeProof'
  // BaaLS Runtime
  | 'GetSender' | 'GetContractId' | 'GetBlockTimestamp' | 'GetBlockHeight'
  | 'EmitEvent' | 'Revert' | 'HashSha256' | 'CallContract' | 'ReadCallResult' | 'TransferValue'
  // ChronoNode
  | 'FetchChronoBlock' | 'FetchCheckpoint' | 'VerifyChronoProof'
  | 'ExtractChronoEvent' | 'ExtractTxBySender' | 'ExtractTxByRecipient' | 'VerifyArchiveRange'
  // Resurgence
  | 'CheckTokenAge' | 'CheckTokenActivityWindow' | 'CheckLiquidityDormancy'
  | 'CheckGovernanceDormancy' | 'CalculateDormancyScore' | 'NormalizeDeadCoinRisk'
  | 'GenerateDormancyProof' | 'EmitDormancyOracleResult';

type NodeType = PolicyNodeType | CanvasNodeType;

interface PolicyNode {
  id: string;
  label: string;
  nodeType: NodeType;
  x: number;
  y: number;
  params: Record<string, string>;
}

interface PolicyEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

interface PolicyGraph {
  name: string;
  description: string;
  nodes: PolicyNode[];
  edges: PolicyEdge[];
}

// ── Node Palette ───────────────────────────────────────────────────────────

interface NodeTypeDef {
  type: NodeType;
  label: string;
  color: string;
  icon: string;
  category: string;
  defaultParams: Record<string, string>;
}

const POLICY_NODES: NodeTypeDef[] = [
  { type: 'input', label: 'Input', color: 'border-blue-500 bg-blue-950/30', icon: '📥', category: 'Policy', defaultParams: {} },
  { type: 'filter', label: 'Filter', color: 'border-yellow-500 bg-yellow-950/30', icon: '🔍', category: 'Policy', defaultParams: { min_confidence_tier: '5' } },
  { type: 'confidence_assigner', label: 'Confidence', color: 'border-purple-500 bg-purple-950/30', icon: '🏷️', category: 'Policy', defaultParams: { tier: '3' } },
  { type: 'multiplier', label: 'Multiplier', color: 'border-green-500 bg-green-950/30', icon: '✕', category: 'Policy', defaultParams: { multiplier: '1.0' } },
  { type: 'dormancy_multiplier', label: 'Dormancy ×', color: 'border-cyan-500 bg-cyan-950/30', icon: '⏳', category: 'Policy', defaultParams: {} },
  { type: 'cap', label: 'Cap', color: 'border-red-500 bg-red-950/30', icon: '🔒', category: 'Policy', defaultParams: { max_value: '100000' } },
  { type: 'weighted_sum', label: 'Weighted Sum', color: 'border-orange-500 bg-orange-950/30', icon: '∑', category: 'Policy', defaultParams: {} },
  { type: 'output', label: 'Output', color: 'border-emerald-500 bg-emerald-950/30', icon: '💰', category: 'Policy', defaultParams: {} },
];

const CANVAS_NODES: NodeTypeDef[] = [
  // Logic
  { type: 'If', label: 'If', color: 'border-amber-500 bg-amber-950/30', icon: '🔀', category: 'Logic', defaultParams: {} },
  { type: 'And', label: 'And', color: 'border-amber-500 bg-amber-950/30', icon: '∧', category: 'Logic', defaultParams: {} },
  { type: 'Or', label: 'Or', color: 'border-amber-500 bg-amber-950/30', icon: '∨', category: 'Logic', defaultParams: {} },
  { type: 'Not', label: 'Not', color: 'border-amber-500 bg-amber-950/30', icon: '¬', category: 'Logic', defaultParams: {} },
  // Arithmetic
  { type: 'Add', label: 'Add', color: 'border-teal-500 bg-teal-950/30', icon: '+', category: 'Arithmetic', defaultParams: {} },
  { type: 'Subtract', label: 'Subtract', color: 'border-teal-500 bg-teal-950/30', icon: '−', category: 'Arithmetic', defaultParams: {} },
  { type: 'Multiply', label: 'Multiply', color: 'border-teal-500 bg-teal-950/30', icon: '×', category: 'Arithmetic', defaultParams: {} },
  { type: 'Divide', label: 'Divide', color: 'border-teal-500 bg-teal-950/30', icon: '÷', category: 'Arithmetic', defaultParams: {} },
  // Control Flow
  { type: 'Start', label: 'Start', color: 'border-lime-500 bg-lime-950/30', icon: '▶', category: 'Flow', defaultParams: {} },
  { type: 'End', label: 'End', color: 'border-lime-500 bg-lime-950/30', icon: '⏹', category: 'Flow', defaultParams: {} },
  // State
  { type: 'ReadStorage', label: 'Read Storage', color: 'border-sky-500 bg-sky-950/30', icon: '📖', category: 'State', defaultParams: { key: 'default' } },
  { type: 'WriteStorage', label: 'Write Storage', color: 'border-sky-500 bg-sky-950/30', icon: '📝', category: 'State', defaultParams: { key: 'default' } },
  // Crypto
  { type: 'VerifySignature', label: 'Verify Sig', color: 'border-fuchsia-500 bg-fuchsia-950/30', icon: '🔏', category: 'Crypto', defaultParams: {} },
  { type: 'DecodeProof', label: 'Decode Proof', color: 'border-fuchsia-500 bg-fuchsia-950/30', icon: '🔓', category: 'Crypto', defaultParams: {} },
  // BaaLS Runtime
  { type: 'GetSender', label: 'Get Sender', color: 'border-rose-500 bg-rose-950/30', icon: '👤', category: 'BaaLS', defaultParams: {} },
  { type: 'GetContractId', label: 'Contract ID', color: 'border-rose-500 bg-rose-950/30', icon: '🆔', category: 'BaaLS', defaultParams: {} },
  { type: 'GetBlockTimestamp', label: 'Block Time', color: 'border-rose-500 bg-rose-950/30', icon: '🕐', category: 'BaaLS', defaultParams: {} },
  { type: 'GetBlockHeight', label: 'Block Height', color: 'border-rose-500 bg-rose-950/30', icon: '📏', category: 'BaaLS', defaultParams: {} },
  { type: 'EmitEvent', label: 'Emit Event', color: 'border-rose-500 bg-rose-950/30', icon: '📡', category: 'BaaLS', defaultParams: { event_name: 'log' } },
  { type: 'Revert', label: 'Revert', color: 'border-rose-500 bg-rose-950/30', icon: '🚫', category: 'BaaLS', defaultParams: { reason: 'error' } },
  { type: 'HashSha256', label: 'SHA256', color: 'border-rose-500 bg-rose-950/30', icon: '🔐', category: 'BaaLS', defaultParams: {} },
  { type: 'CallContract', label: 'Call Contract', color: 'border-rose-500 bg-rose-950/30', icon: '📞', category: 'BaaLS', defaultParams: { contract_id: '' } },
  { type: 'ReadCallResult', label: 'Call Result', color: 'border-rose-500 bg-rose-950/30', icon: '📋', category: 'BaaLS', defaultParams: {} },
  { type: 'TransferValue', label: 'Transfer', color: 'border-rose-500 bg-rose-950/30', icon: '💸', category: 'BaaLS', defaultParams: { amount: '0' } },
  // ChronoNode
  { type: 'FetchChronoBlock', label: 'Fetch Block', color: 'border-indigo-500 bg-indigo-950/30', icon: '🧱', category: 'ChronoNode', defaultParams: {} },
  { type: 'FetchCheckpoint', label: 'Checkpoint', color: 'border-indigo-500 bg-indigo-950/30', icon: '📍', category: 'ChronoNode', defaultParams: {} },
  { type: 'VerifyChronoProof', label: 'Verify Proof', color: 'border-indigo-500 bg-indigo-950/30', icon: '✅', category: 'ChronoNode', defaultParams: {} },
  { type: 'ExtractChronoEvent', label: 'Extract Event', color: 'border-indigo-500 bg-indigo-950/30', icon: '📤', category: 'ChronoNode', defaultParams: {} },
  { type: 'ExtractTxBySender', label: 'Tx by Sender', color: 'border-indigo-500 bg-indigo-950/30', icon: '📨', category: 'ChronoNode', defaultParams: { sender: '' } },
  { type: 'ExtractTxByRecipient', label: 'Tx by Recipient', color: 'border-indigo-500 bg-indigo-950/30', icon: '📩', category: 'ChronoNode', defaultParams: { recipient: '' } },
  { type: 'VerifyArchiveRange', label: 'Archive Range', color: 'border-indigo-500 bg-indigo-950/30', icon: '🗂️', category: 'ChronoNode', defaultParams: {} },
  // Resurgence
  { type: 'CheckTokenAge', label: 'Token Age', color: 'border-emerald-500 bg-emerald-950/30', icon: '📅', category: 'Resurgence', defaultParams: {} },
  { type: 'CheckTokenActivityWindow', label: 'Activity Window', color: 'border-emerald-500 bg-emerald-950/30', icon: '🪟', category: 'Resurgence', defaultParams: {} },
  { type: 'CheckLiquidityDormancy', label: 'Liq Dormancy', color: 'border-emerald-500 bg-emerald-950/30', icon: '💧', category: 'Resurgence', defaultParams: {} },
  { type: 'CheckGovernanceDormancy', label: 'Gov Dormancy', color: 'border-emerald-500 bg-emerald-950/30', icon: '🏛️', category: 'Resurgence', defaultParams: {} },
  { type: 'CalculateDormancyScore', label: 'Dormancy Score', color: 'border-emerald-500 bg-emerald-950/30', icon: '📊', category: 'Resurgence', defaultParams: {} },
  { type: 'NormalizeDeadCoinRisk', label: 'Normalize Risk', color: 'border-emerald-500 bg-emerald-950/30', icon: '⚖️', category: 'Resurgence', defaultParams: {} },
  { type: 'GenerateDormancyProof', label: 'Gen Proof', color: 'border-emerald-500 bg-emerald-950/30', icon: '🔮', category: 'Resurgence', defaultParams: {} },
  { type: 'EmitDormancyOracleResult', label: 'Emit Oracle', color: 'border-emerald-500 bg-emerald-950/30', icon: '📢', category: 'Resurgence', defaultParams: {} },
];

const ALL_NODE_TYPES = [...POLICY_NODES, ...CANVAS_NODES];

// Group nodes by category
function groupByCategory(nodes: NodeTypeDef[]): Map<string, NodeTypeDef[]> {
  const map = new Map<string, NodeTypeDef[]>();
  for (const n of nodes) {
    const group = map.get(n.category) || [];
    group.push(n);
    map.set(n.category, group);
  }
  return map;
}

// ── BaalsClient ────────────────────────────────────────────────────────────

const BAALS_API_BASE = process.env.NEXT_PUBLIC_BAALS_API_URL || 'http://localhost:3030';

interface CompileResult {
  wasm_hash: string;
  wasm_size: number;
  node_count: number;
  edge_count: number;
  valid: boolean;
  errors: string[];
}

async function compileGraph(graph: PolicyGraph): Promise<CompileResult> {
  const res = await fetch(`${BAALS_API_BASE}/api/v1/canvas/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graph }),
  });
  if (!res.ok) throw new Error(`Compilation failed: ${res.statusText}`);
  return res.json();
}

async function simulateGraph(graph: PolicyGraph, inputs?: Record<string, unknown>): Promise<{ output: unknown; trace: SimulationStep[] }> {
  const res = await fetch(`${BAALS_API_BASE}/api/v1/canvas/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graph, inputs }),
  });
  if (!res.ok) throw new Error(`Simulation failed: ${res.statusText}`);
  return res.json();
}

interface SimulationStep {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  input: unknown;
  output: unknown;
  durationUs: number;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

let nodeCounter = 0;
let edgeCounter = 0;

const EDGE_COLOR = '#6366f1';
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

function getNodeColorClass(nodeType: NodeType): string {
  return ALL_NODE_TYPES.find(n => n.type === nodeType)?.color || 'border-gray-500 bg-gray-950/30';
}

function getNodeIcon(nodeType: NodeType): string {
  return ALL_NODE_TYPES.find(n => n.type === nodeType)?.icon || '⬜';
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CanvasEditorPage() {
  const [graph, setGraph] = useState<PolicyGraph>({
    name: 'Untitled Contract',
    description: '',
    nodes: [],
    edges: [],
  });

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [simTrace, setSimTrace] = useState<SimulationStep[] | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'compile' | 'simulate' | 'export'>('compile');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Policy', 'Logic', 'Arithmetic']));

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const addNode = useCallback((nodeType: NodeType) => {
    const def = ALL_NODE_TYPES.find((n) => n.type === nodeType)!;
    const id = `node-${++nodeCounter}`;
    setGraph((g) => ({
      ...g,
      nodes: [
        ...g.nodes,
        {
          id,
          label: def.label,
          nodeType,
          x: 100 + (g.nodes.length % 4) * 220,
          y: 100 + Math.floor(g.nodes.length / 4) * 120,
          params: { ...def.defaultParams },
        },
      ],
    }));
    setSelectedNode(id);
  }, []);

  const updateNodePos = useCallback((id: string, x: number, y: number) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
  }, []);

  const updateNodeParam = useCallback((nodeId: string, key: string, value: string) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === nodeId ? { ...n, params: { ...n.params, [key]: value } } : n
      ),
    }));
  }, []);

  const removeNode = useCallback((id: string) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.filter((n) => n.id !== id),
      edges: g.edges.filter((e) => e.source !== id && e.target !== id),
    }));
    if (selectedNode === id) setSelectedNode(null);
    if (editingNode === id) setEditingNode(null);
  }, [selectedNode, editingNode]);

  const addEdge = useCallback((source: string, target: string) => {
    if (source === target) return;
    setGraph((g) => {
      if (g.edges.some((e) => e.source === source && e.target === target)) return g;
      return {
        ...g,
        edges: [...g.edges, { id: `edge-${++edgeCounter}`, source, target, weight: 1.0 }],
      };
    });
  }, []);

  const removeEdge = useCallback((id: string) => {
    setGraph((g) => ({
      ...g,
      edges: g.edges.filter((e) => e.id !== id),
    }));
  }, []);

  const validateGraph = useCallback(() => {
    const errors: string[] = [];
    if (graph.nodes.length === 0) errors.push('Graph must have at least one node');

    // Check for Start/End or Input/Output pair
    const hasCanvasStart = graph.nodes.some((n) => n.nodeType === 'Start');
    const hasCanvasEnd = graph.nodes.some((n) => n.nodeType === 'End');
    const hasPolicyInput = graph.nodes.some((n) => n.nodeType === 'input');
    const hasPolicyOutput = graph.nodes.some((n) => n.nodeType === 'output');

    if (!hasCanvasStart && !hasPolicyInput && graph.nodes.length > 0) {
      errors.push('Graph should have a Start node (Canvas) or Input node (Policy)');
    }
    if (!hasCanvasEnd && !hasPolicyOutput && graph.nodes.length > 0) {
      errors.push('Graph should have an End node (Canvas) or Output node (Policy)');
    }

    // Check connectivity
    for (const node of graph.nodes) {
      const hasIncoming = graph.edges.some((e) => e.target === node.id);
      const hasOutgoing = graph.edges.some((e) => e.source === node.id);
      if (node.nodeType !== 'input' && node.nodeType !== 'Start' && !hasIncoming) {
        errors.push(`Node "${node.label}" (${node.id}) has no incoming edges`);
      }
      if (node.nodeType !== 'output' && node.nodeType !== 'End' && !hasOutgoing) {
        errors.push(`Node "${node.label}" (${node.id}) has no outgoing edges`);
      }
    }
    setValidationResult({ valid: errors.length === 0, errors });
  }, [graph]);

  const handleCompile = useCallback(async () => {
    setCompiling(true);
    setCompileResult(null);
    setSimTrace(null);
    try {
      const result = await compileGraph(graph);
      setCompileResult(result);
    } catch (err: any) {
      setCompileResult({ valid: false, errors: [err.message], wasm_hash: '', wasm_size: 0, node_count: 0, edge_count: 0 });
    } finally {
      setCompiling(false);
      setActiveTab('compile');
    }
  }, [graph]);

  const handleSimulate = useCallback(async () => {
    setSimulating(true);
    setSimTrace(null);
    try {
      const result = await simulateGraph(graph);
      setSimTrace(result.trace);
    } catch (err: any) {
      setCompileResult({ valid: false, errors: [err.message], wasm_hash: '', wasm_size: 0, node_count: 0, edge_count: 0 });
    } finally {
      setSimulating(false);
      setActiveTab('simulate');
    }
  }, [graph]);

  const exportGraph = useCallback(() => {
    const json = JSON.stringify(graph, null, 2);
    setExportJson(json);
  }, [graph]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'svg') {
      setSelectedNode(null);
    }
  }, []);

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const selectedDef = selectedNode ? nodeMap.get(selectedNode) : null;
  const groupedNodes = groupByCategory(ALL_NODE_TYPES);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 mb-2">
        <Link href="/canvas" className="hover:text-white">Canvas</Link>
        <span className="mx-2">/</span>
        <span className="text-white">Editor</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Canvas Contract Editor</h1>
          <p className="text-gray-400 text-sm mt-1">Build visual WASM contracts with {ALL_NODE_TYPES.length} node types across {groupedNodes.size} categories</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setGraph({ name: 'Untitled Contract', description: '', nodes: [], edges: [] })}
            className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-xl border border-gray-700">New</button>
          <button onClick={validateGraph}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl">Validate</button>
          <button onClick={handleCompile} disabled={compiling}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50">
            {compiling ? 'Compiling...' : 'Compile WASM'}
          </button>
          <button onClick={handleSimulate} disabled={simulating}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50">
            {simulating ? 'Running...' : 'Simulate'}
          </button>
          <button onClick={exportGraph}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-xl">Export</button>
        </div>
      </div>

      <input type="text" value={graph.name}
        onChange={(e) => setGraph((g) => ({ ...g, name: e.target.value }))}
        className="bg-transparent border-b border-gray-700 text-xl font-bold text-white mb-6 px-1 focus:outline-none focus:border-blue-500 w-full"
        placeholder="Contract Name" />

      <div className="flex gap-6">
        {/* ── Toolbar ── */}
        <div className="w-52 shrink-0 space-y-2 max-h-[600px] overflow-y-auto pr-2">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Node Palette</div>
          {[...groupedNodes.entries()].map(([category, nodes]) => (
            <div key={category}>
              <button onClick={() => toggleCategory(category)}
                className="w-full text-left text-xs font-semibold text-gray-300 py-1 flex items-center gap-1 hover:text-white">
                <span className="text-[10px]">{expandedCategories.has(category) ? '▼' : '▶'}</span>
                {category} ({nodes.length})
              </button>
              {expandedCategories.has(category) && nodes.map(def => (
                <button key={def.type} onClick={() => addNode(def.type)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded-md border ${def.color} hover:opacity-80 transition-opacity flex items-center gap-1.5 mb-0.5`}>
                  <span className="text-xs">{def.icon}</span>
                  <span className="truncate">{def.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* ── Canvas ── */}
        <div className="flex-1 bg-gray-900/60 rounded-2xl border border-gray-700 overflow-hidden relative" style={{ minHeight: 500 }}>
          <svg ref={svgRef} className="w-full h-full min-h-[500px] cursor-default" onClick={handleCanvasClick}>
            {graph.edges.map((edge) => {
              const src = nodeMap.get(edge.source);
              const tgt = nodeMap.get(edge.target);
              if (!src || !tgt) return null;
              const x1 = src.x + NODE_WIDTH / 2;
              const y1 = src.y + NODE_HEIGHT;
              const x2 = tgt.x + NODE_WIDTH / 2;
              const y2 = tgt.y;
              return (
                <g key={edge.id}>
                  <path
                    d={`M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`}
                    stroke={EDGE_COLOR} strokeWidth={2} fill="none"
                    className="cursor-pointer hover:stroke-red-400"
                    onClick={(e) => { e.stopPropagation(); removeEdge(edge.id); }} />
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5} fill="#9ca3af" fontSize={10} textAnchor="middle">{edge.weight}x</text>
                </g>
              );
            })}
            {graph.nodes.map((node) => {
              const colorClass = getNodeColorClass(node.nodeType);
              const icon = getNodeIcon(node.nodeType);
              const isSelected = selectedNode === node.id;
              return (
                <g key={node.id}
                  onMouseDown={(e) => {
                    if (e.button === 0) {
                      const rect = svgRef.current?.getBoundingClientRect();
                      if (rect) {
                        setDraggingNode(node.id);
                        setDragOffset({ x: e.clientX - rect.left - node.x, y: e.clientY - rect.top - node.y });
                      }
                      setSelectedNode(node.id);
                    }
                  }}
                  onMouseUp={() => {
                    if (connectingFrom && connectingFrom !== node.id) addEdge(connectingFrom, node.id);
                    setConnectingFrom(null);
                  }}
                  className="cursor-grab active:cursor-grabbing">
                  <rect x={node.x} y={node.y} width={NODE_WIDTH} height={NODE_HEIGHT} rx={12}
                    className={`fill-gray-900 stroke-2 ${isSelected ? 'stroke-blue-400' : colorClass.split(' ')[0].replace('bg-', 'stroke-').replace('/30', '/60')}`}
                    strokeOpacity={0.8} />
                  <text x={node.x + 12} y={node.y + 24} fill="currentColor" fontSize={16}>{icon}</text>
                  <text x={node.x + 36} y={node.y + 28} fill="white" fontSize={12} fontWeight={600}>{node.label}</text>
                  <text x={node.x + 12} y={node.y + 48} fill="#6b7280" fontSize={9} fontFamily="monospace">{node.id}</text>
                  <circle cx={node.x + NODE_WIDTH / 2} cy={node.y + NODE_HEIGHT} r={6} fill="#374151"
                    stroke={EDGE_COLOR} strokeWidth={2} className="cursor-crosshair hover:fill-indigo-700"
                    onMouseDown={(e) => { e.stopPropagation(); setConnectingFrom(node.id); }} />
                  <circle cx={node.x + NODE_WIDTH / 2} cy={node.y} r={4} fill="#374151" stroke="#6b7280" strokeWidth={1} />
                </g>
              );
            })}
          </svg>
          {draggingNode && (
            <div className="absolute inset-0 z-10"
              onMouseMove={(e) => {
                const rect = svgRef.current?.getBoundingClientRect();
                if (rect && draggingNode) {
                  updateNodePos(draggingNode, e.clientX - rect.left - dragOffset.x, e.clientY - rect.top - dragOffset.y);
                }
              }}
              onMouseUp={() => setDraggingNode(null)}
              onMouseLeave={() => setDraggingNode(null)} />
          )}
        </div>

        {/* ── Right Panel ── */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Properties */}
          {selectedDef ? (
            <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">{getNodeIcon(selectedDef.nodeType)} {selectedDef.label}</h3>
                <button
                  onClick={() => setEditingNode(editingNode === selectedDef.id ? null : selectedDef.id)}
                  className="text-xs text-blue-400 hover:text-blue-300">
                  {editingNode === selectedDef.id ? 'Done' : 'Edit'}
                </button>
              </div>
              <div className="text-[10px] text-gray-500 font-mono">{selectedDef.id} · {selectedDef.nodeType}</div>

              {editingNode === selectedDef.id ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-400">Label</label>
                    <input type="text" defaultValue={selectedDef.label}
                      onBlur={(e) => setGraph((g) => ({
                        ...g, nodes: g.nodes.map((n) => n.id === selectedDef.id ? { ...n, label: e.target.value } : n)
                      }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  {Object.entries(selectedDef.params).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-400">{key}</label>
                      <input type="text" value={value}
                        onChange={(e) => updateNodeParam(selectedDef.id, key, e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500" />
                    </div>
                  ))}
                  <button onClick={() => removeNode(selectedDef.id)}
                    className="w-full bg-red-900/40 hover:bg-red-900/60 text-red-400 text-xs px-3 py-2 rounded-lg border border-red-800 mt-2">
                    Delete Node
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(selectedDef.params).length > 0 ? (
                    Object.entries(selectedDef.params).map(([key, value]) => (
                      <div key={key}>
                        <div className="text-xs text-gray-400">{key}</div>
                        <div className="text-sm text-white font-mono bg-gray-900 px-2 py-1 rounded">{value}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-500">No parameters</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/60 text-center">
              <div className="text-2xl mb-2">👆</div>
              <div className="text-xs text-gray-400">Select a node to edit properties</div>
            </div>
          )}

          {/* Validation */}
          {validationResult && (
            <div className={`rounded-xl p-4 border ${validationResult.valid ? 'bg-green-950/30 border-green-800' : 'bg-red-950/30 border-red-800'}`}>
              <div className={`text-sm font-semibold mb-1 ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                {validationResult.valid ? '✓ Valid' : '✗ Invalid'}
              </div>
              {validationResult.errors.map((e, i) => (
                <div key={i} className="text-xs text-red-300 mt-1">{e}</div>
              ))}
            </div>
          )}

          {/* Compile Result */}
          {compileResult && (
            <div className={`rounded-xl p-4 border ${compileResult.valid ? 'bg-green-950/30 border-green-800' : 'bg-red-950/30 border-red-800'}`}>
              <div className={`text-sm font-semibold mb-2 ${compileResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                {compileResult.valid ? '✓ WASM Compiled' : '✗ Compilation Failed'}
              </div>
              {compileResult.errors.map((e, i) => (
                <div key={i} className="text-xs text-red-300 mt-1">{e}</div>
              ))}
              {compileResult.valid && (
                <div className="text-xs text-gray-300 space-y-1 mt-2">
                  <div>Hash: <span className="font-mono text-green-300">{compileResult.wasm_hash.slice(0, 12)}...</span></div>
                  <div>Size: {compileResult.wasm_size} bytes</div>
                  <div>{compileResult.node_count} nodes · {compileResult.edge_count} edges</div>
                </div>
              )}
            </div>
          )}

          {/* Simulation Trace / Debugger */}
          {simTrace && simTrace.length > 0 && (
            <div className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-2">
                <span className="text-xs font-semibold text-white">🔍 Execution Trace</span>
                <span className="text-[10px] text-gray-500">({simTrace.length} steps)</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {simTrace.map((step, i) => (
                  <div key={i} className={`px-4 py-2 border-b border-gray-700/50 last:border-0 ${step.error ? 'bg-red-950/20' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 font-mono">#{i + 1}</span>
                      <span className="text-xs text-white font-medium">{step.nodeLabel}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{step.nodeType}</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px]">
                      <span className="text-gray-500">in: <span className="text-gray-300 font-mono">{JSON.stringify(step.input)}</span></span>
                      <span className="text-gray-500">out: <span className="text-green-300 font-mono">{JSON.stringify(step.output)}</span></span>
                      {step.error && <span className="text-red-400">err: {step.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="text-xs text-gray-500">
            {graph.nodes.length} node{graph.nodes.length !== 1 ? 's' : ''} · {graph.edges.length} edge{graph.edges.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {exportJson && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setExportJson(null)}>
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Exported Contract Graph</h3>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(exportJson); setExportJson(null); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl">Copy</button>
                <button onClick={() => setExportJson(null)}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-4 py-2 rounded-xl">Close</button>
              </div>
            </div>
            <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-xl overflow-x-auto max-h-96 font-mono">{exportJson}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
