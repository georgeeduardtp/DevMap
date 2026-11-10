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

export type ProjectCommand = {
  kind: "script" | "documented" | "container";
  label: string;
  text: string;
  file: string;
  componentId: string | null;
};

export type FolderScheme = {
  directories: string[];
  partial: boolean;
};

export type ProjectConnection = {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence: string;
  evidence?: ComponentNode["evidence"];
};

export type ArchitectureGraph = {
  id: string;
  name: string;
  scannedAt: string;
  mode: "static";
  filesInspected: number;
  nodes: ComponentNode[];
  edges: ProjectConnection[];
  warnings: string[];
  technologies?: DetectedTechnology[];
  composeNames?: Record<string, string>;
  commands?: ProjectCommand[];
  folderScheme?: FolderScheme | null;
};
