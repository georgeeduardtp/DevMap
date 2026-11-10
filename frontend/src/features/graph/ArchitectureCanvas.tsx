"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { applyNodeChanges, Background, BaseEdge, Controls, getBezierPath, getSmoothStepPath, Handle, MarkerType, MiniMap,
  Position, ReactFlow, type Edge, type EdgeProps, type Node, type NodeProps, type OnNodeDrag, type OnNodesChange,
  type XYPosition } from "@xyflow/react";
import TechnologyIcon from "@/components/TechnologyIcon";
import type { ArchitectureGraph } from "@/lib/types";
import { readModulePositions, saveModulePositions, type ModulePositions } from "./diagram-layout";
import type { ProjectModule } from "./project-modules";

type ModuleFrameNode = Node<{
  label: string;
  path: string;
  composeId?: string;
  onSelect: (id: string) => void;
}, "moduleFrame">;
type DiagramNode = Node<{ label: string; title: string; technology: string }, "architectureNode">;
type CanvasNode = ModuleFrameNode | DiagramNode;
type DiagramEdge = Edge<{ packaging: boolean; pulseDelay?: number }, "architecture">;

function ModuleFrame({ data }: NodeProps<ModuleFrameNode>) {
  const composeId = data.composeId;
  return <div className="module-frame-heading" title="Arrastra para mover la sección">
    <div className="module-frame-title">
      <span className="module-frame-grip" aria-hidden="true">⠿</span>
      <strong title={data.label}>{data.label}</strong>
      {composeId && <button className="compose-frame-button nodrag" type="button" onClick={(event) => {
        event.stopPropagation();
        data.onSelect(composeId);
      }}>
        Comandos ↗
      </button>}
    </div>
    <code title={data.path}>{data.path || "Raíz del proyecto"}</code>
  </div>;
}

function ArchitectureNode({ data, isConnectable }: NodeProps<DiagramNode>) {
  return <>
    <Handle id="left" type="target" position={Position.Left} isConnectable={isConnectable} />
    <Handle id="left" type="source" position={Position.Left} isConnectable={isConnectable} />
    <div className="architecture-node-label">
      <TechnologyIcon technology={data.technology} colored />
      <strong title={data.title}>{data.label}</strong>
    </div>
    <span className="architecture-node-status"><i aria-hidden="true" />Estado desconocido</span>
    <Handle id="right" type="target" position={Position.Right} isConnectable={isConnectable} />
    <Handle id="right" type="source" position={Position.Right} isConnectable={isConnectable} />
    <Handle id="top" type="target" position={Position.Top} isConnectable={isConnectable} className="architecture-vertical-handle" />
    <Handle id="top" type="source" position={Position.Top} isConnectable={isConnectable} className="architecture-vertical-handle" />
    <Handle id="bottom" type="target" position={Position.Bottom} isConnectable={isConnectable} className="architecture-vertical-handle" />
    <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={isConnectable} className="architecture-vertical-handle" />
  </>;
}

const nodeTypes = { moduleFrame: ModuleFrame, architectureNode: ArchitectureNode };

function ArchitectureEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
  style, label, labelStyle, labelBgStyle, markerStart, markerEnd, interactionWidth }: EdgeProps<DiagramEdge>) {
  const edgePath = data?.packaging ? getBezierPath : getSmoothStepPath;
  const [path, labelX, labelY] = edgePath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return <>
    {data?.pulseDelay !== undefined && <path className="architecture-edge-pulse"
      d={path} pathLength={1} fill="none" aria-hidden="true" style={{ animationDelay: `${data.pulseDelay}ms` }} />}
    <BaseEdge id={id} path={path} style={style} label={label} labelX={labelX} labelY={labelY}
      labelStyle={labelStyle} labelBgStyle={labelBgStyle} markerStart={markerStart} markerEnd={markerEnd}
      interactionWidth={interactionWidth} />
  </>;
}

const edgeTypes = { architecture: ArchitectureEdge };
const layout = { padding: 10, nodeWidth: 200, nodeHeight: 84, nodeGap: 78, nodeRow: 108, header: 57, groupGap: 36 };
const MAX_EDGE_PULSES = 16;
const moduleFramePrefix = "devmap-module:";

function createLayoutNodes(modules: ProjectModule[], modulePositions: ModulePositions, onSelect: (id: string) => void) {
  const nodes: CanvasNode[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  for (const [index, module] of modules.entries()) {
    const columns = Math.min(2, module.nodes.length);
    const width = layout.padding * 2 + columns * layout.nodeWidth + (columns - 1) * layout.nodeGap;
    const height = layout.header + Math.ceil(module.nodes.length / columns) * layout.nodeRow;
    const frame: ModuleFrameNode = {
      id: moduleFramePrefix + module.id,
      type: "moduleFrame",
      position: modulePositions.get(module.id) ?? { x, y },
      data: {
        label: module.label,
        path: module.composeFile ?? (module.path ? `${module.path}/` : ""),
        composeId: module.composeFile ? module.id : undefined,
        onSelect,
      },
      className: "module-frame",
      draggable: true,
      dragHandle: ".module-frame-heading",
      selectable: false,
      focusable: false,
      style: { width, height, pointerEvents: "none",
        "--diagram-entry-delay": `${Math.min(index * 48, 180)}ms` } as CSSProperties,
    };

    rowHeight = Math.max(rowHeight, height);
    if (index % 2 === 0) {
      x += width + layout.groupGap;
    } else {
      y += rowHeight + layout.groupGap;
      x = 0;
      rowHeight = 0;
    }

    const prefix = module.path ? `${module.path} · ` : "";
    const children: DiagramNode[] = module.nodes.map((node, i) => {
      const childX = layout.padding + (i % columns) * (layout.nodeWidth + layout.nodeGap);
      const childY = layout.header + Math.floor(i / columns) * layout.nodeRow;
      return {
        id: node.id,
        type: "architectureNode",
        parentId: frame.id,
        position: { x: childX, y: childY },
        selected: false,
        className: "architecture-node",
        style: { width: layout.nodeWidth,
          "--diagram-entry-delay": `${Math.min(50 + index * 48 + i * 30, 240)}ms` } as CSSProperties,
        data: {
          label: node.label.startsWith(prefix) ? node.label.slice(prefix.length) : node.label,
          title: node.label,
          technology: node.technology,
        },
      };
    });
    nodes.push(frame, ...children);
  }
  return nodes;
}

export default function ArchitectureCanvas({ graph, modules, selectedId, onSelect }: {
  graph: ArchitectureGraph;
  modules: ProjectModule[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [initialLayout] = useState(() => {
    const positions = readModulePositions(graph.id);
    return { positions, nodes: createLayoutNodes(modules, positions, onSelect) };
  });
  const [nodes, setNodes] = useState(initialLayout.nodes);
  const [modulePositions, setModulePositions] = useState(initialLayout.positions);
  useEffect(() => {
    if (modulePositions.size) saveModulePositions(graph.id, modulePositions);
  }, [graph.id, modulePositions]);

  const onNodesChange: OnNodesChange<CanvasNode> = useCallback((changes) => {
    // Preserve measured dimensions so React Flow can keep rendering attached edges during the drag.
    const layoutChanges = changes.filter((change) => change.type === "position" || change.type === "dimensions");
    if (layoutChanges.length) setNodes((current) => applyNodeChanges(layoutChanges, current));
  }, []);

  const onNodeDragStop: OnNodeDrag<CanvasNode> = (_, node) => {
    if (node.type !== "moduleFrame") return;
    const moduleId = node.id.slice(moduleFramePrefix.length);
    setModulePositions((current) => new Map(current).set(moduleId, node.position));
  };

  const displayedNodes = useMemo(() => nodes.map((node) => {
    if (node.type === "moduleFrame") {
      return node.id === moduleFramePrefix + selectedId ? { ...node, className: "module-frame module-frame-active" } : node;
    }
    return node.id === selectedId ? { ...node, selected: true } : node;
  }), [nodes, selectedId]);

  // Keep the attachment sides steady during a drag. The endpoints follow the cards through React Flow.
  const positions = useMemo(() => {
    const frames = new Map<string, XYPosition>();
    const cards = new Map<string, XYPosition>();
    for (const node of initialLayout.nodes) {
      if (node.type === "moduleFrame") {
        frames.set(node.id, modulePositions.get(node.id.slice(moduleFramePrefix.length)) ?? node.position);
      } else if (node.parentId) {
        const frame = frames.get(node.parentId);
        if (frame) cards.set(node.id, { x: frame.x + node.position.x, y: frame.y + node.position.y });
      }
    }
    return cards;
  }, [initialLayout.nodes, modulePositions]);
  const edges = useMemo<DiagramEdge[]>(() => {
    const selectedModule = modules.find((module) => module.id === selectedId);
    const focusedNodes = new Set(selectedModule ? selectedModule.nodes.map((node) => node.id) : [selectedId]);
    let pulseCount = 0;

    return graph.edges.map((edge) => {
      const inferred = edge.confidence === "inferred";
      const packaging = edge.label === "packages";
      const focused = edge.id === selectedId || focusedNodes.has(edge.source) || focusedNodes.has(edge.target);
      const pulseDelay = focused && pulseCount < MAX_EDGE_PULSES ? pulseCount++ * 85 : undefined;
      const source = positions.get(edge.source) ?? { x: 0, y: 0 };
      const target = positions.get(edge.target) ?? { x: 0, y: 0 };
      const vertical = source.y !== target.y &&
        Math.abs(source.y - target.y) - layout.nodeHeight > Math.abs(source.x - target.x) - layout.nodeWidth;
      const color = focused ? "#a4b7a8" : "#65756b";
      return {
        ...edge,
        type: "architecture",
        selected: edge.id === selectedId,
        sourceHandle: vertical ? (source.y > target.y ? "top" : "bottom") : (source.x > target.x ? "left" : "right"),
        targetHandle: vertical ? (source.y > target.y ? "bottom" : "top") : (source.x >= target.x ? "right" : "left"),
        data: { packaging, pulseDelay },
        label: focused ? (packaging ? "Empaqueta" : inferred ? "Inferida" : "Declarada") : undefined,
        markerEnd: packaging ? { type: MarkerType.ArrowClosed, width: 14, height: 14, color } : undefined,
        style: {
          stroke: color,
          strokeWidth: focused ? 1.6 : undefined,
          strokeDasharray: inferred ? "6 5" : undefined,
        },
        labelStyle: { fill: "#bac8bd", fontSize: 11 }, labelBgStyle: { fill: "#0e1916" },
      };
    });
  }, [graph.edges, positions, modules, selectedId]);
  return <ReactFlow nodes={displayedNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
    fitView fitViewOptions={{ padding: 0.22 }}
    minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false}
    onNodesChange={onNodesChange}
    onNodeDragStop={onNodeDragStop}
    onNodeClick={(_, node) => { if (node.type === "architectureNode") onSelect(node.id); }}
    onEdgeClick={(_, edge) => onSelect(edge.id)}
    onPaneClick={() => onSelect("")}
    proOptions={{ hideAttribution: false }} colorMode="dark">
    <Background color="#293932" gap={24} size={1} />
    <Controls showInteractive={false} />
    <MiniMap pannable zoomable nodeColor={(node) => node.type === "moduleFrame" ? "transparent" : "#718178"}
      maskColor="rgba(8,17,15,.7)" />
  </ReactFlow>;
}
