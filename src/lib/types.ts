export type CompareMode =
  | "wt-mutant"
  | "isoform-canonical"
  | "pdb-vs-alphafold";

export type StructureSource =
  | "alphafold"
  | "pdb"
  | "url"
  | "modelarchive";

export interface StructureCandidate {
  id: string;
  label: string;
  source: StructureSource;
  loadId: string;
  notes?: string;
  paeUrl?: string | null;
  plddtUrl?: string | null;
  modelUrl?: string | null;
}

export interface DiseaseAssociation {
  id: string;
  name: string;
  score: number;
}

export interface DrugAssociation {
  id: string;
  name: string;
  phase: number;
  status: string;
  source: "open-targets" | "chembl";
}

export interface GraphNode {
  id: string;
  label: string;
  type: "target" | "disease" | "drug";
  weight: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  label?: string;
}

export interface TargetGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ConfidenceSummary {
  hasAlphaFold: boolean;
  paeUrl?: string | null;
  plddtUrl?: string | null;
}

export interface ResolvedTarget {
  requestedGene: string;
  canonicalGene: string;
  accession: string;
  ensemblId?: string | null;
  proteinName: string;
  functionComment: string;
  sequenceLength: number;
  compareCandidates: StructureCandidate[];
  diseases: DiseaseAssociation[];
  drugs: DrugAssociation[];
  graph: TargetGraph;
  confidence: ConfidenceSummary;
  sourceTrace: Array<{ source: string; detail: string }>;
  warnings: string[];
}

export interface AnnotationItem {
  id: string;
  residue: number;
  chain?: string;
  label: string;
  color: string;
  createdAt: string;
  author: string;
}

export interface StoryEvent {
  id: string;
  type:
    | "target-loaded"
    | "mode-changed"
    | "structures-loaded"
    | "annotation-added"
    | "graph-focus"
    | "compare-updated";
  at: string;
  payload: Record<string, unknown>;
}
