"use client";

import type { TargetGraph } from "@/lib/types";

export function TherapyGraph({
  graph,
  onSelectNode
}: {
  graph: TargetGraph;
  onSelectNode?: (nodeId: string) => void;
}) {
  const width = 540;
  const height = 320;
  const cx = width / 2;
  const cy = height / 2;

  const target = graph.nodes.find((node) => node.type === "target");
  const diseases = graph.nodes.filter((node) => node.type === "disease");
  const drugs = graph.nodes.filter((node) => node.type === "drug");

  const positions = new Map<string, { x: number; y: number }>();

  if (target) {
    positions.set(target.id, { x: cx, y: cy });
  }

  diseases.forEach((node, index) => {
    const angle = (-Math.PI / 2) + (index / Math.max(1, diseases.length)) * Math.PI;
    positions.set(node.id, {
      x: cx - 190 * Math.cos(angle),
      y: cy + 120 * Math.sin(angle)
    });
  });

  drugs.forEach((node, index) => {
    const angle = (-Math.PI / 2) + (index / Math.max(1, drugs.length)) * Math.PI;
    positions.set(node.id, {
      x: cx + 190 * Math.cos(angle),
      y: cy + 120 * Math.sin(angle)
    });
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      <rect x="0" y="0" width={width} height={height} fill="transparent" />

      {graph.edges.map((edge) => {
        const start = positions.get(edge.source);
        const end = positions.get(edge.target);
        if (!start || !end) {
          return null;
        }

        return (
          <line
            key={edge.id}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="rgba(18, 33, 25, 0.24)"
            strokeWidth={Math.max(1, edge.weight * 2)}
          />
        );
      })}

      {graph.nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) {
          return null;
        }

        const radius = node.type === "target" ? 18 : Math.max(8, node.weight * 9);

        return (
          <g
            key={node.id}
            transform={`translate(${pos.x}, ${pos.y})`}
            role="button"
            onClick={() => onSelectNode?.(node.id)}
            className="cursor-pointer"
          >
            <circle
              r={radius}
              className={
                node.type === "target"
                  ? "graph-node-target"
                  : node.type === "disease"
                    ? "graph-node-disease"
                    : "graph-node-drug"
              }
              fillOpacity="0.9"
              stroke="rgba(18, 33, 25, 0.25)"
            />
            <text
              x={0}
              y={radius + 13}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(18, 33, 25, 0.8)"
            >
              {node.label.slice(0, 20)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
