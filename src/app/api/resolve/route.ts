import { NextRequest, NextResponse } from "next/server";

import { withCache } from "@/lib/cache";
import { fetchJson, postJson } from "@/lib/http";
import type {
  DiseaseAssociation,
  DrugAssociation,
  GraphEdge,
  GraphNode,
  ResolvedTarget,
  StructureCandidate,
  TargetGraph
} from "@/lib/types";

const UNIPROT_SEARCH_URL = "https://rest.uniprot.org/uniprotkb/search";
const UNIPROT_ENTRY_URL = "https://rest.uniprot.org/uniprotkb";
const OPEN_TARGETS_URL = "https://api.platform.opentargets.org/api/v4/graphql";

const ALPHAFOLD_API_V2 = "https://alphafold.ebi.ac.uk/api/prediction/";
const ALPHAFOLD_LEGACY = "https://alphafold.com/api/prediction/";

const RCSB_ENTRY_URL = "https://data.rcsb.org/rest/v1/core/entry";
const RCSB_MODEL_SERVER = "https://models.rcsb.org";
const RCSB_VOLUME_SERVER = "https://maps.rcsb.org";

const CHEMBL_TARGET_SEARCH = "https://www.ebi.ac.uk/chembl/api/data/target/search.json";
const CHEMBL_MECHANISM = "https://www.ebi.ac.uk/chembl/api/data/mechanism.json";

interface UniProtSearchResponse {
  results?: Array<Record<string, unknown>>;
}

interface OpenTargetsResponse {
  data?: {
    target?: {
      id?: string;
      associatedDiseases?: {
        rows?: Array<{ score?: number; disease?: { id?: string; name?: string } }>;
      };
      knownDrugs?: {
        rows?: Array<{
          phase?: number;
          status?: string;
          drug?: { id?: string; name?: string; maximumClinicalTrialPhase?: number };
        }>;
      };
    };
  };
}

function normalizeEnsemblId(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const match = raw.match(/ENSG\d+/);
  return match ? match[0] : raw;
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function GET(req: NextRequest) {
  const gene = req.nextUrl.searchParams.get("gene")?.trim().toUpperCase();
  if (!gene) {
    return NextResponse.json({ error: "Missing gene query parameter" }, { status: 400 });
  }

  try {
    const payload = await withCache<ResolvedTarget>(`resolve:v2:${gene}`, 60 * 10, async () => {
      const sourceTrace: Array<{ source: string; detail: string }> = [];
      const warnings: string[] = [];

      const uniProt = await fetchUniProt(gene);
      sourceTrace.push({ source: "UniProt", detail: `Resolved ${uniProt.accession}` });

      const [alphaFold, openTargets, rcsbMeta, chembl] = await Promise.all([
        fetchAlphaFold(uniProt.accession).catch((error: unknown) => {
          warnings.push(`AlphaFold unavailable: ${(error as Error).message}`);
          return null;
        }),
        fetchOpenTargets(uniProt.ensemblId).catch((error: unknown) => {
          warnings.push(`Open Targets unavailable: ${(error as Error).message}`);
          return { diseases: [] as DiseaseAssociation[], drugs: [] as DrugAssociation[] };
        }),
        fetchRcsbMeta(uniProt.pdbIds[0]).catch(() => null),
        fetchChembl(uniProt.canonicalGene, uniProt.chemblTargetId).catch(() => ({
          targetId: null,
          drugs: [] as DrugAssociation[]
        }))
      ]);

      if (alphaFold?.modelId) {
        sourceTrace.push({ source: "AlphaFold", detail: `Model ${alphaFold.modelId}` });
      } else {
        sourceTrace.push({ source: "AlphaFold", detail: "No model metadata" });
      }

      if (openTargets.diseases.length > 0 || openTargets.drugs.length > 0) {
        sourceTrace.push({
          source: "Open Targets",
          detail: `${openTargets.diseases.length} diseases, ${openTargets.drugs.length} drugs`
        });
      } else {
        sourceTrace.push({ source: "Open Targets", detail: "No rows returned" });
      }

      if (rcsbMeta) {
        sourceTrace.push({
          source: "RCSB",
          detail: `${rcsbMeta.pdbId} (${rcsbMeta.resolution ?? "n/a"}A)`
        });
      }

      if (chembl.targetId) {
        sourceTrace.push({
          source: "ChEMBL",
          detail: `${chembl.targetId} (${chembl.drugs.length} mechanism-linked compounds)`
        });
      }

      sourceTrace.push({ source: "Fetched", detail: new Date().toISOString() });

      const compareCandidates = buildCompareCandidates({
        accession: uniProt.accession,
        canonicalGene: uniProt.canonicalGene,
        isoformIds: uniProt.isoformIds,
        pdbIds: uniProt.pdbIds,
        alphaFold
      });

      const drugs = uniqueBy(
        [...openTargets.drugs, ...chembl.drugs],
        (drug) => `${drug.id}:${drug.source}`
      ).slice(0, 12);

      const graph = buildTargetGraph({
        target: uniProt.canonicalGene,
        diseases: openTargets.diseases,
        drugs
      });

      return {
        requestedGene: gene,
        canonicalGene: uniProt.canonicalGene,
        accession: uniProt.accession,
        ensemblId: uniProt.ensemblId,
        proteinName: uniProt.proteinName,
        functionComment: uniProt.functionComment,
        sequenceLength: uniProt.sequenceLength,
        compareCandidates,
        diseases: openTargets.diseases,
        drugs,
        graph,
        confidence: {
          hasAlphaFold: Boolean(alphaFold?.modelId),
          paeUrl: alphaFold?.paeUrl,
          plddtUrl: alphaFold?.plddtUrl
        },
        sourceTrace,
        warnings
      } satisfies ResolvedTarget;
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "s-maxage=120, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message || "Failed to resolve target"
      },
      { status: 500 }
    );
  }
}

async function fetchUniProt(gene: string) {
  const primary = `gene_exact:${gene} AND organism_id:9606 AND reviewed:true`;
  const fallback = `gene:${gene} AND organism_id:9606 AND reviewed:true`;

  let data = await queryUniProt(primary);
  if (!data.results?.length) {
    data = await queryUniProt(fallback);
  }

  const entry = data.results?.[0];
  if (!entry) {
    throw new Error(`No reviewed human UniProt entry for ${gene}`);
  }

  const accession = String(entry.primaryAccession || "");

  const proteinDescription = (entry.proteinDescription as Record<string, unknown> | undefined) ?? {};
  const proteinName =
    (
      (proteinDescription.recommendedName as Record<string, unknown> | undefined)?.fullName as
        | { value?: string }
        | undefined
    )?.value || "Unknown protein";

  const comments = (entry.comments as Array<Record<string, unknown>> | undefined) ?? [];
  const functionCommentEntry = comments.find((comment) => comment.commentType === "FUNCTION");
  const functionTexts =
    (functionCommentEntry?.texts as Array<{ value?: string }> | undefined) ?? [];
  const functionComment = functionTexts[0]?.value || "No function comment available.";

  const crossRefs = (entry.uniProtKBCrossReferences as Array<Record<string, unknown>>) ?? [];
  const pdbIds = crossRefs
    .filter((ref) => ref.database === "PDB")
    .map((ref) => String(ref.id))
    .slice(0, 8);

  const ensemblCandidate = crossRefs.find((ref) => ref.database === "Ensembl");
  const ensemblProperties =
    (ensemblCandidate?.properties as Array<{ value?: string }> | undefined) ?? [];
  const ensemblOptions = [
    typeof ensemblCandidate?.id === "string" ? ensemblCandidate.id : "",
    ...ensemblProperties.map((property) => property.value ?? "")
  ].filter(Boolean);

  const ensemblId =
    ensemblOptions.map((value) => normalizeEnsemblId(value)).find((value) => value?.startsWith("ENSG")) ||
    null;

  const chemblTargetId = crossRefs.find((ref) => ref.database === "ChEMBL")?.id;

  const fullEntry = await fetchJson<Record<string, unknown>>(
    `${UNIPROT_ENTRY_URL}/${encodeURIComponent(accession)}.json`
  );

  const canonicalGene =
    ((fullEntry.genes as Array<Record<string, unknown>> | undefined)?.[0]?.geneName as {
      value?: string;
    } | undefined)?.value || gene;

  const sequenceLength = Number((fullEntry.sequence as Record<string, unknown> | undefined)?.length || 0);

  const isoformIds = extractIsoforms(fullEntry);

  return {
    accession,
    proteinName,
    functionComment,
    canonicalGene,
    sequenceLength,
    ensemblId,
    chemblTargetId: typeof chemblTargetId === "string" ? chemblTargetId : null,
    pdbIds,
    isoformIds
  };
}

function extractIsoforms(entry: Record<string, unknown>): string[] {
  const comments = (entry.comments as Array<Record<string, unknown>> | undefined) ?? [];
  const alternativeProducts = comments.find(
    (comment) => comment.commentType === "ALTERNATIVE_PRODUCTS"
  );

  const isoforms =
    (alternativeProducts?.isoforms as Array<Record<string, unknown>> | undefined) ?? [];

  const ids = isoforms
    .flatMap((isoform) => (isoform.isoformIds as string[] | undefined) ?? [])
    .filter((value) => value.includes("-"));

  return uniqueBy(ids, (value) => value).slice(0, 4);
}

async function queryUniProt(query: string): Promise<UniProtSearchResponse> {
  const params = new URLSearchParams({
    query,
    format: "json",
    size: "1",
    fields: "accession,id,protein_name,gene_names,cc_function,xref_pdb,xref_ensembl,xref_chembl"
  });

  return fetchJson<UniProtSearchResponse>(`${UNIPROT_SEARCH_URL}?${params.toString()}`);
}

async function fetchAlphaFold(accession: string) {
  const apiBase = process.env.ALPHAFOLD_API_BASE || ALPHAFOLD_API_V2;

  try {
    const payload = await fetchJson<Array<Record<string, unknown>>>(
      `${apiBase}${encodeURIComponent(accession)}`
    );
    const model = payload?.[0];
    if (!model) {
      return null;
    }

    return {
      modelId: String(model.entryId || accession),
      modelUrl: model.pdbUrl?.toString() || null,
      paeUrl: model.paeDocUrl?.toString() || null,
      plddtUrl: model.plddtDocUrl?.toString() || null
    };
  } catch {
    const payload = await fetchJson<Array<Record<string, unknown>>>(
      `${ALPHAFOLD_LEGACY}${encodeURIComponent(accession)}`
    );
    const model = payload?.[0];
    if (!model) {
      return null;
    }

    return {
      modelId: String(model.entryId || accession),
      modelUrl: model.pdbUrl?.toString() || null,
      paeUrl: model.paeDocUrl?.toString() || null,
      plddtUrl: model.plddtDocUrl?.toString() || null
    };
  }
}

async function fetchOpenTargets(ensemblId: string | null) {
  if (!ensemblId) {
    return {
      diseases: [] as DiseaseAssociation[],
      drugs: [] as DrugAssociation[]
    };
  }

  const query = `
    query TargetBundle($ensemblId: String!) {
      target(ensemblId: $ensemblId) {
        id
        associatedDiseases(page: { index: 0, size: 10 }) {
          rows {
            score
            disease {
              id
              name
            }
          }
        }
        knownDrugs(size: 10) {
          rows {
            phase
            status
            drug {
              id
              name
              maximumClinicalTrialPhase
            }
          }
        }
      }
    }
  `;

  const payload = await postJson<OpenTargetsResponse>(OPEN_TARGETS_URL, {
    query,
    variables: { ensemblId }
  });

  const diseases =
    payload.data?.target?.associatedDiseases?.rows
      ?.map((row) => ({
        id: row.disease?.id || "unknown",
        name: row.disease?.name || "Unknown disease",
        score: Number(row.score || 0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) || [];

  const drugs =
    payload.data?.target?.knownDrugs?.rows
      ?.map((row) => ({
        id: row.drug?.id || "unknown",
        name: row.drug?.name || "Unknown drug",
        phase: Number(row.phase ?? row.drug?.maximumClinicalTrialPhase ?? 0),
        status: row.status || "n/a",
        source: "open-targets" as const
      }))
      .sort((a, b) => b.phase - a.phase)
      .slice(0, 10) || [];

  return { diseases, drugs };
}

async function fetchRcsbMeta(pdbId?: string) {
  if (!pdbId) {
    return null;
  }

  const payload = await fetchJson<Record<string, unknown>>(`${RCSB_ENTRY_URL}/${pdbId}`);
  const info = payload.rcsb_entry_info as Record<string, unknown> | undefined;
  const resolution = Array.isArray(info?.resolution_combined)
    ? Number(info?.resolution_combined?.[0])
    : null;

  return {
    pdbId,
    title: (payload.struct as { title?: string } | undefined)?.title ?? "n/a",
    resolution,
    modelServerUrl: `${RCSB_MODEL_SERVER}/${pdbId}.bcif`,
    volumeServerUrl: `${RCSB_VOLUME_SERVER}/${pdbId}`
  };
}

async function fetchChembl(gene: string, chemblTargetFromUniProt: string | null) {
  const targetId =
    chemblTargetFromUniProt ||
    (await fetchJson<{ targets?: Array<{ target_chembl_id?: string }> }>(
      `${CHEMBL_TARGET_SEARCH}?q=${encodeURIComponent(gene)}&limit=1`
    )).targets?.[0]?.target_chembl_id ||
    null;

  if (!targetId) {
    return { targetId: null, drugs: [] as DrugAssociation[] };
  }

  const payload = await fetchJson<{
    mechanisms?: Array<{
      molecule_chembl_id?: string;
      pref_name?: string;
      max_phase?: number;
      mechanism_of_action?: string;
    }>;
  }>(`${CHEMBL_MECHANISM}?target_chembl_id=${encodeURIComponent(targetId)}&limit=12`);

  const drugs =
    payload.mechanisms
      ?.map((item) => ({
        id: item.molecule_chembl_id || "unknown",
        name: item.pref_name || item.molecule_chembl_id || "Unknown compound",
        phase: Number(item.max_phase || 0),
        status: item.mechanism_of_action || "n/a",
        source: "chembl" as const
      }))
      .slice(0, 10) || [];

  return {
    targetId,
    drugs
  };
}

function buildCompareCandidates(input: {
  accession: string;
  canonicalGene: string;
  isoformIds: string[];
  pdbIds: string[];
  alphaFold: {
    modelId: string;
    modelUrl: string | null;
    paeUrl: string | null;
    plddtUrl: string | null;
  } | null;
}): StructureCandidate[] {
  const candidates: StructureCandidate[] = [];

  if (input.alphaFold) {
    candidates.push({
      id: `af:${input.accession}`,
      label: `${input.canonicalGene} canonical (AlphaFold)` ,
      source: "alphafold",
      loadId: input.accession,
      paeUrl: input.alphaFold.paeUrl,
      plddtUrl: input.alphaFold.plddtUrl,
      modelUrl: input.alphaFold.modelUrl
    });
  }

  if (input.isoformIds.length > 0) {
    candidates.push({
      id: `iso:${input.isoformIds[0]}`,
      label: `Isoform ${input.isoformIds[0]}`,
      source: "alphafold",
      loadId: input.isoformIds[0],
      notes: "Try against canonical for isoform deltas"
    });
  }

  for (const pdbId of input.pdbIds.slice(0, 3)) {
    candidates.push({
      id: `pdb:${pdbId}`,
      label: `Experimental PDB ${pdbId}`,
      source: "pdb",
      loadId: pdbId,
      notes: "Load via RCSB"
    });
  }

  return candidates;
}

function buildTargetGraph(input: {
  target: string;
  diseases: DiseaseAssociation[];
  drugs: DrugAssociation[];
}): TargetGraph {
  const nodes: GraphNode[] = [
    {
      id: `target:${input.target}`,
      label: input.target,
      type: "target",
      weight: 1
    }
  ];

  const edges: GraphEdge[] = [];

  for (const disease of input.diseases.slice(0, 8)) {
    const diseaseId = `disease:${disease.id}`;
    nodes.push({
      id: diseaseId,
      label: disease.name,
      type: "disease",
      weight: Math.max(0.2, disease.score)
    });

    edges.push({
      id: `edge:target:${disease.id}`,
      source: `target:${input.target}`,
      target: diseaseId,
      weight: Math.max(0.2, disease.score),
      label: disease.score.toFixed(2)
    });
  }

  for (const drug of input.drugs.slice(0, 10)) {
    const drugId = `drug:${drug.id}`;
    nodes.push({
      id: drugId,
      label: drug.name,
      type: "drug",
      weight: Math.max(0.2, drug.phase / 4)
    });

    edges.push({
      id: `edge:target:drug:${drug.id}`,
      source: `target:${input.target}`,
      target: drugId,
      weight: Math.max(0.2, drug.phase / 4),
      label: `Phase ${drug.phase}`
    });
  }

  return {
    nodes: uniqueBy(nodes, (node) => node.id),
    edges: uniqueBy(edges, (edge) => edge.id)
  };
}
