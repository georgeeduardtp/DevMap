export type ComponentNode = {
  id: string;
  label: string;
  kind: string;
  technology: string;
  status: "unknown";
  evidence: { file: string; description: string }[];
};

export type DetectedTechnology = {
  name: string;
  category: "language" | "framework" | "library" | "tool" | "runtime" | "infrastructure";
  evidence: ComponentNode["evidence"];
};

export type ArchitectureGraph = {
  id: string;
  name: string;
  scannedAt: string;
  mode: "static";
  filesInspected: number;
  nodes: ComponentNode[];
  edges: { id: string; source: string; target: string; label: string; confidence: string }[];
  warnings: string[];
  technologies?: DetectedTechnology[];
};
