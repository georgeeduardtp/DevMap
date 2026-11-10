"use client";

import { useMemo, type CSSProperties } from "react";
import { Background, BaseEdge, Controls, getSmoothStepPath, Handle, MiniMap, Position, ReactFlow,
  type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import TechnologyIcon from "@/components/TechnologyIcon";
import type { ArchitectureGraph } from "@/lib/types";
import type { ProjectModule } from "./project-modules";

type ModuleFrameNode = Node<{
  label: string;
  path: string;
  composeId?: string;
  onSelect: (id: string) => void;
}, "moduleFrame">;
type DiagramNode = Node<{ label: string; title: string; technology: string }, "architectureNode">;
type DiagramEdge = Edge<{ pulseDelay?: number }, "architecture">;

function ModuleFrame({ data }: NodeProps<ModuleFrameNode>) {
  if (data.composeId) {
    const composeId = data.composeId;
    return <button className="module-frame-heading compose-frame-button" type="button" onClick={(event) => {
      event.stopPropagation();
      data.onSelect(composeId);
    }}>
      <span className="compose-frame-title"><strong title={data.label}>{data.label}</strong><span>Comandos ↗</span></span>
      <code title={data.path}>{data.path}</code>
    </button>;
  }
  return <div className="module-frame-heading">
    <strong>{data.label}</strong>
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
  </>;
}

const nodeTypes = { moduleFrame: ModuleFrame, architectureNode: ArchitectureNode };

function ArchitectureEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
  style, label, labelStyle, labelBgStyle, markerStart, markerEnd, interactionWidth }: EdgeProps<DiagramEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return <>
    {data?.pulseDelay !== undefined && <path className="architecture-edge-pulse"
      d={path} pathLength={1} fill="none" aria-hidden="true" style={{ animationDelay: `${data.pulseDelay}ms` }} />}
    <BaseEdge id={id} path={path} style={style} label={label} labelX={labelX} labelY={labelY}
      labelStyle={labelStyle} labelBgStyle={labelBgStyle} markerStart={markerStart} markerEnd={markerEnd}
      interactionWidth={interactionWidth} />
  </>;
}

const edgeTypes = { architecture: ArchitectureEdge };
const layout = { padding: 10, nodeWidth: 200, nodeGap: 78, nodeRow: 108, header: 57, groupGap: 36 };
const MAX_EDGE_PULSES = 16;

export default function ArchitectureCanvas({ graph, modules, selectedId, onSelect }: {
  graph: ArchitectureGraph;
  modules: ProjectModule[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { nodes, horizontalPositions } = useMemo(() => {
    const positioned: Node[] = [];
    const horizontalPositions = new Map<string, number>();
    let x = 0;
    let y = 0;
    let rowHeight = 0;

    for (const [index, module] of modules.entries()) {
      const columns = Math.min(2, module.nodes.length);
      const width = layout.padding * 2 + columns * layout.nodeWidth + (columns - 1) * layout.nodeGap;
      const height = layout.header + Math.ceil(module.nodes.length / columns) * layout.nodeRow;
      const frame: ModuleFrameNode = {
        id: `devmap-module-${index}`,
        type: "moduleFrame",
        position: { x, y },
        data: {
          label: module.label,
          path: module.composeFile ?? (module.path ? `${module.path}/` : ""),
          composeId: module.composeFile ? module.id : undefined,
          onSelect,
        },
        className: module.id === selectedId ? "module-frame module-frame-active" : "module-frame",
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
        horizontalPositions.set(node.id, frame.position.x + childX);
        return {
          id: node.id,
          type: "architectureNode",
          parentId: frame.id,
          position: { x: childX, y: layout.header + Math.floor(i / columns) * layout.nodeRow },
          selected: node.id === selectedId,
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
      positioned.push(frame, ...children);
    }
    return { nodes: positioned, horizontalPositions };
  }, [modules, selectedId, onSelect]);
  const edges = useMemo<DiagramEdge[]>(() => {
    const selectedModule = modules.find((module) => module.id === selectedId);
    const focusedNodes = new Set(selectedModule ? selectedModule.nodes.map((node) => node.id) : [selectedId]);
    let pulseCount = 0;

    return graph.edges.map((edge) => {
      const inferred = edge.confidence === "inferred";
      const focused = focusedNodes.has(edge.source) || focusedNodes.has(edge.target);
      const pulseDelay = focused && pulseCount < MAX_EDGE_PULSES ? pulseCount++ * 85 : undefined;
      const sourceX = horizontalPositions.get(edge.source) ?? 0;
      const targetX = horizontalPositions.get(edge.target) ?? 0;
      return {
        ...edge,
        type: "architecture",
        sourceHandle: sourceX > targetX ? "left" : "right",
        targetHandle: sourceX >= targetX ? "right" : "left",
        data: { pulseDelay },
        label: focused ? (inferred ? "Inferida" : "Declarada") : undefined,
        style: {
          stroke: focused ? "#a4b7a8" : "#65756b",
          strokeWidth: focused ? 1.6 : undefined,
          strokeDasharray: inferred ? "6 5" : undefined,
        },
        labelStyle: { fill: "#bac8bd", fontSize: 11 }, labelBgStyle: { fill: "#0e1916" },
      };
    });
  }, [graph.edges, horizontalPositions, modules, selectedId]);
  return <ReactFlow key={graph.id + graph.scannedAt} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
    fitView fitViewOptions={{ padding: 0.22 }}
    minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false}
    onNodeClick={(_, node) => onSelect(node.type === "moduleFrame" ? String(node.data.composeId ?? "") : node.id)}
    onPaneClick={() => onSelect("")}
    proOptions={{ hideAttribution: false }} colorMode="dark">
    <Background color="#293932" gap={24} size={1} />
    <Controls showInteractive={false} />
    <MiniMap pannable zoomable nodeColor={(node) => node.type === "moduleFrame" ? "transparent" : "#718178"}
      maskColor="rgba(8,17,15,.7)" />
  </ReactFlow>;
}
