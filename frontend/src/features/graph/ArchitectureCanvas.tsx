"use client";

import { useMemo } from "react";
import { Background, Controls, MiniMap, Position, ReactFlow, type Node, type Edge } from "@xyflow/react";
import TechnologyIcon from "@/components/TechnologyIcon";
import type { ArchitectureGraph } from "@/lib/types";

export default function ArchitectureCanvas({ graph, selectedId, onSelect }: {
  graph: ArchitectureGraph;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const nodes = useMemo<Node[]>(() => {
    const counts = [0, 0, 0];
    return graph.nodes.map((node) => {
      const column = node.kind === "application" ? 0 : node.kind === "container" ? 1 : 2;
      const row = counts[column]++;
      return {
        id: node.id, position: { x: column * 340, y: row * 155 },
        sourcePosition: Position.Right, targetPosition: Position.Left,
        selected: node.id === selectedId,
        className: `architecture-node ${node.kind}`,
        data: {
          label: <div>
            <div className="node-technology">
              <TechnologyIcon technology={node.technology} />
              <span className="node-tech">{node.technology}</span>
            </div>
            <strong>{node.label}</strong>
            <span className="node-state">○ Estado desconocido</span>
          </div>,
        },
      };
    });
  }, [graph, selectedId]);
  const edges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({
    ...edge, type: "smoothstep", animated: false,
    label: edge.confidence === "inferred" ? "uso posible" : "dependencia declarada",
    style: { stroke: edge.confidence === "inferred" ? "#617c86" : "#7ecfb0", strokeDasharray: edge.confidence === "inferred" ? "6 5" : undefined },
    labelStyle: { fill: "#b7c8c4", fontSize: 11 }, labelBgStyle: { fill: "#142320" },
  })), [graph]);
  return <ReactFlow key={graph.id + graph.scannedAt} nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.22 }}
    minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false}
    onNodeClick={(_, node) => onSelect(node.id)}
    onPaneClick={() => onSelect("")}
    proOptions={{ hideAttribution: false }} colorMode="dark">
    <Background color="#31433e" gap={24} size={1} />
    <Controls showInteractive={false} />
    <MiniMap pannable zoomable nodeColor="#568875" maskColor="rgba(8,17,15,.7)" />
  </ReactFlow>;
}
