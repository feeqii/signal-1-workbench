const OPEN_TARGETS_URL = "https://api.platform.opentargets.org/api/v4/graphql";
const UNIPROT_URL = "https://rest.uniprot.org/uniprotkb/search";
const ALPHAFOLD_URL = "https://alphafold.ebi.ac.uk/api/prediction/";

const STORAGE_KEYS = {
  settings: "signal1.settings.v2",
  portfolio: "signal1.portfolio.v2"
};

const MAX_BATCH_GENES = 10;
const MAX_PORTFOLIO_ITEMS = 100;

const DEFAULT_SETTINGS = {
  weights: {
    disease: 40,
    tractability: 25,
    drug: 20,
    structure: 15
  },
  thresholds: {
    high: 75,
    medium: 45
  }
};

const elements = {
  triageForm: document.getElementById("triage-form"),
  geneInput: document.getElementById("gene-input"),
  contextInput: document.getElementById("context-input"),
  runButton: document.getElementById("run-button"),
  status: document.getElementById("status"),

  saveDossierButton: document.getElementById("save-dossier"),
  exportJsonButton: document.getElementById("export-json"),
  exportMdButton: document.getElementById("export-md"),

  batchForm: document.getElementById("batch-form"),
  batchInput: document.getElementById("batch-input"),
  batchButton: document.getElementById("batch-button"),
  batchTableWrap: document.getElementById("batch-table-wrap"),

  results: document.getElementById("results"),
  scoreValue: document.getElementById("score-value"),
  scoreBand: document.getElementById("score-band"),
  scoreRationale: document.getElementById("score-rationale"),
  scoreBreakdown: document.getElementById("score-breakdown"),
  ringProgress: document.getElementById("ring-progress"),
  snapshotGrid: document.getElementById("snapshot-grid"),
  diseaseTableWrap: document.getElementById("disease-table-wrap"),
  drugTableWrap: document.getElementById("drug-table-wrap"),
  structureWrap: document.getElementById("structure-wrap"),
  summaryText: document.getElementById("summary-text"),
  copySummaryButton: document.getElementById("copy-summary"),
  sourceTrace: document.getElementById("source-trace"),

  compareForm: document.getElementById("compare-form"),
  compareLeftInput: document.getElementById("compare-left-input"),
  compareRightInput: document.getElementById("compare-right-input"),
  compareStatus: document.getElementById("compare-status"),
  compareWrap: document.getElementById("compare-wrap"),

  portfolioWrap: document.getElementById("portfolio-wrap"),
  clearPortfolioButton: document.getElementById("clear-portfolio"),

  weightDisease: document.getElementById("weight-disease"),
  weightTractability: document.getElementById("weight-tractability"),
  weightDrug: document.getElementById("weight-drug"),
  weightStructure: document.getElementById("weight-structure"),
  weightDiseaseValue: document.getElementById("weight-disease-value"),
  weightTractabilityValue: document.getElementById("weight-tractability-value"),
  weightDrugValue: document.getElementById("weight-drug-value"),
  weightStructureValue: document.getElementById("weight-structure-value"),
  thresholdHigh: document.getElementById("threshold-high"),
  thresholdMedium: document.getElementById("threshold-medium"),
  weightsTotal: document.getElementById("weights-total"),
  saveSettingsButton: document.getElementById("save-settings"),
  resetSettingsButton: document.getElementById("reset-settings")
};

const state = {
  settings: loadSettings(),
  portfolio: loadPortfolio(),
  currentDossier: null,
  rawCache: new Map(),
  batchDossiers: new Map()
};

initialize();

function initialize() {
  bindEvents();
  renderSettingsControls(state.settings);
  renderPortfolio();
  elements.batchTableWrap.append(emptyState("Run a batch to see ranked candidates."));
  elements.compareWrap.append(emptyState("Compare two genes to highlight the stronger candidate."));
  setStatus("Workbench ready.");
}

function bindEvents() {
  for (const chip of document.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => {
      elements.geneInput.value = chip.dataset.gene || "";
      elements.geneInput.focus();
    });
  }

  elements.triageForm.addEventListener("submit", handleSingleTriage);
  elements.batchForm.addEventListener("submit", handleBatchTriage);
  elements.compareForm.addEventListener("submit", handleCompare);

  elements.copySummaryButton.addEventListener("click", copySummary);
  elements.saveDossierButton.addEventListener("click", saveCurrentDossier);
  elements.exportJsonButton.addEventListener("click", exportCurrentDossierJson);
  elements.exportMdButton.addEventListener("click", exportCurrentDossierMarkdown);

  elements.portfolioWrap.addEventListener("click", handlePortfolioActions);
  elements.batchTableWrap.addEventListener("click", handleBatchActions);

  elements.clearPortfolioButton.addEventListener("click", () => {
    if (!state.portfolio.length) {
      return;
    }

    state.portfolio = [];
    persistPortfolio();
    renderPortfolio();
    setStatus("Portfolio cleared.");
  });

  const sliders = [
    elements.weightDisease,
    elements.weightTractability,
    elements.weightDrug,
    elements.weightStructure
  ];

  for (const slider of sliders) {
    slider.addEventListener("input", updateSettingsLabelsFromControls);
  }

  elements.thresholdHigh.addEventListener("input", updateSettingsLabelsFromControls);
  elements.thresholdMedium.addEventListener("input", updateSettingsLabelsFromControls);

  elements.saveSettingsButton.addEventListener("click", saveSettingsFromControls);
  elements.resetSettingsButton.addEventListener("click", resetSettings);
}

async function handleSingleTriage(event) {
  event.preventDefault();
  const gene = normalizeGene(elements.geneInput.value);
  const context = elements.contextInput.value.trim();

  if (!gene) {
    setStatus("Enter a gene symbol.", "error");
    return;
  }

  elements.runButton.disabled = true;
  setStatus(`Building dossier for ${gene}...`);

  try {
    const dossier = await buildDossier(gene, context);
    state.currentDossier = dossier;
    renderDossier(dossier);
    setStatus(`${gene} dossier ready (${dossier.scoreResult.total}/100).`);
  } catch (error) {
    setStatus(error.message || `Failed to build dossier for ${gene}.`, "error");
  } finally {
    elements.runButton.disabled = false;
  }
}

async function handleBatchTriage(event) {
  event.preventDefault();
  const genes = parseGeneList(elements.batchInput.value);

  if (!genes.length) {
    setStatus("Add at least one gene in the batch input.", "error");
    return;
  }

  const limitedGenes = genes.slice(0, MAX_BATCH_GENES);
  if (genes.length > MAX_BATCH_GENES) {
    setStatus(
      `Batch trimmed to ${MAX_BATCH_GENES} genes to keep API load stable.`,
      "error"
    );
  }

  elements.batchButton.disabled = true;
  state.batchDossiers.clear();
  const failures = [];

  for (let index = 0; index < limitedGenes.length; index += 1) {
    const gene = limitedGenes[index];
    setStatus(`Batch ${index + 1}/${limitedGenes.length}: ${gene}...`);

    try {
      const dossier = await buildDossier(gene, "Batch run", { useCache: true });
      state.batchDossiers.set(dossier.id, dossier);
    } catch (error) {
      failures.push({ gene, reason: error.message || "Unknown error" });
    }
  }

  const ranked = [...state.batchDossiers.values()].sort(
    (a, b) => b.scoreResult.total - a.scoreResult.total
  );

  renderBatchTable(ranked, failures);
  elements.batchButton.disabled = false;

  if (failures.length) {
    setStatus(
      `Batch complete with ${failures.length} failure(s). ${ranked.length} dossiers ranked.`,
      "error"
    );
    return;
  }

  setStatus(`Batch complete. ${ranked.length} dossiers ranked.`);
}

async function handleCompare(event) {
  event.preventDefault();
  const left = normalizeGene(elements.compareLeftInput.value);
  const right = normalizeGene(elements.compareRightInput.value);

  if (!left || !right) {
    elements.compareStatus.textContent = "Provide two gene symbols for comparison.";
    elements.compareStatus.classList.add("error");
    return;
  }

  elements.compareStatus.classList.remove("error");
  elements.compareStatus.textContent = `Comparing ${left} vs ${right}...`;

  const [leftResult, rightResult] = await Promise.allSettled([
    buildDossier(left, "Compare-left", { useCache: true }),
    buildDossier(right, "Compare-right", { useCache: true })
  ]);

  if (leftResult.status !== "fulfilled" || rightResult.status !== "fulfilled") {
    elements.compareStatus.textContent =
      "Comparison failed for one or both genes. Check symbols and retry.";
    elements.compareStatus.classList.add("error");
    return;
  }

  renderCompare(leftResult.value, rightResult.value);
  elements.compareStatus.textContent = "Comparison ready.";
}

async function buildDossier(gene, context, options = {}) {
  const data = await resolveTargetData(gene, options);
  const scoreResult = scoreTarget(data, state.settings);
  const summary = buildSummary({ gene, context, data, scoreResult });

  return {
    id: makeId(gene),
    gene,
    context,
    createdAt: new Date().toISOString(),
    uniprot: data.uniprot,
    openTargets: data.openTargets,
    alphaFold: data.alphaFold,
    sourceTrace: data.sourceTrace,
    warnings: data.warnings,
    scoreResult,
    summary
  };
}

async function resolveTargetData(gene, { useCache = true } = {}) {
  if (useCache && state.rawCache.has(gene)) {
    return state.rawCache.get(gene);
  }

  const sourceTrace = [];
  const warnings = [];

  const uniprot = await fetchUniProt(gene);
  sourceTrace.push({
    source: "UniProt",
    detail: `Resolved ${uniprot.accession}`
  });

  const [openTargetsResult, alphaFoldResult] = await Promise.allSettled([
    fetchOpenTargetsBundle(uniprot.ensemblId),
    fetchAlphaFold(uniprot.accession)
  ]);

  let openTargets = null;
  if (openTargetsResult.status === "fulfilled") {
    openTargets = openTargetsResult.value;
    sourceTrace.push({
      source: "Open Targets",
      detail: openTargets.target?.id
        ? `Loaded ${openTargets.target.id}`
        : "No target details found"
    });
    warnings.push(...(openTargets.warnings || []));
  } else {
    warnings.push("Open Targets request failed.");
    sourceTrace.push({
      source: "Open Targets",
      detail: "Unavailable"
    });
  }

  let alphaFold = null;
  if (alphaFoldResult.status === "fulfilled") {
    alphaFold = alphaFoldResult.value;
    sourceTrace.push({
      source: "AlphaFold",
      detail: alphaFold?.modelId ? `Model ${alphaFold.modelId}` : "No model"
    });
  } else {
    warnings.push("AlphaFold request failed.");
    sourceTrace.push({
      source: "AlphaFold",
      detail: "Unavailable"
    });
  }

  sourceTrace.push({
    source: "Fetched",
    detail: new Date().toLocaleString()
  });

  const data = {
    uniprot,
    openTargets,
    alphaFold,
    sourceTrace,
    warnings
  };

  state.rawCache.set(gene, data);
  return data;
}

async function fetchUniProt(geneSymbol) {
  const primaryQuery = `gene_exact:${geneSymbol} AND organism_id:9606 AND reviewed:true`;
  const fallbackQuery = `gene:${geneSymbol} AND organism_id:9606 AND reviewed:true`;

  let data = await queryUniProt(primaryQuery);
  if (!data?.results?.length) {
    data = await queryUniProt(fallbackQuery);
  }

  const entry = data?.results?.[0];
  if (!entry) {
    throw new Error(`No reviewed human UniProt entry found for ${geneSymbol}.`);
  }

  const crossRefs = entry.uniProtKBCrossReferences || [];
  const ensemblId = extractEnsemblId(crossRefs);

  return {
    accession: entry.primaryAccession,
    uniprotId: entry.uniProtkbId || "n/a",
    proteinName:
      entry.proteinDescription?.recommendedName?.fullName?.value ||
      entry.proteinDescription?.submissionNames?.[0]?.fullName?.value ||
      "n/a",
    functionComment:
      entry.comments
        ?.find((comment) => comment.commentType === "FUNCTION")
        ?.texts?.[0]?.value || "No function comment available.",
    sequenceLength: entry.sequence?.length || null,
    pdbCount: crossRefs.filter((ref) => ref.database === "PDB").length,
    ensemblId,
    canonicalGene:
      entry.genes?.[0]?.geneName?.value ||
      entry.genes?.[0]?.synonyms?.[0]?.value ||
      geneSymbol
  };
}

async function queryUniProt(query) {
  const params = new URLSearchParams({
    query,
    format: "json",
    size: "1",
    fields: "accession,id,protein_name,gene_names,length,cc_function,xref_ensembl,xref_pdb"
  });

  return fetchJson(`${UNIPROT_URL}?${params.toString()}`);
}

function extractEnsemblId(crossRefs) {
  for (const ref of crossRefs) {
    if (ref.database !== "Ensembl") {
      continue;
    }

    if (typeof ref.id === "string" && ref.id.startsWith("ENSG")) {
      return normalizeEnsemblId(ref.id);
    }

    for (const property of ref.properties || []) {
      if (property.value && String(property.value).startsWith("ENSG")) {
        return normalizeEnsemblId(String(property.value));
      }
    }
  }

  return null;
}

function normalizeEnsemblId(value) {
  const match = String(value).match(/ENSG\d+/);
  return match ? match[0] : String(value).trim();
}

async function fetchOpenTargetsBundle(ensemblId) {
  if (!ensemblId) {
    return {
      target: null,
      diseases: [],
      drugs: [],
      warnings: ["Missing Ensembl ID from UniProt; Open Targets lookup skipped."]
    };
  }

  const query = `
    query TargetBundle($ensemblId: String!) {
      target(ensemblId: $ensemblId) {
        id
        approvedSymbol
        approvedName
        biotype
        tractability {
          label
          modality
          value
        }
        associatedDiseases(page: { index: 0, size: 8 }) {
          rows {
            score
            disease {
              id
              name
            }
          }
        }
        knownDrugs(size: 8) {
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

  const payload = await postOpenTargets(query, { ensemblId });
  const target = payload?.target || null;

  return {
    target,
    diseases: target?.associatedDiseases?.rows || [],
    drugs: target?.knownDrugs?.rows || [],
    warnings: []
  };
}

async function postOpenTargets(query, variables) {
  const response = await fetch(OPEN_TARGETS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`Open Targets request failed (${response.status}).`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message || "Open Targets query error.");
  }

  return payload.data;
}

async function fetchAlphaFold(accession) {
  const data = await fetchJson(`${ALPHAFOLD_URL}${encodeURIComponent(accession)}`);
  const model = Array.isArray(data) ? data[0] : null;

  if (!model) {
    return null;
  }

  return {
    modelId: model.entryId || accession,
    modelUrl: model.pdbUrl || model.cifUrl || null,
    paeUrl: model.paeDocUrl || null,
    plddtUrl: model.plddtDocUrl || null,
    latestVersion: model.latestVersion || null
  };
}

function scoreTarget(data, settings) {
  const weights = settings.weights;
  const weightTotal =
    weights.disease + weights.tractability + weights.drug + weights.structure;

  const topDiseaseScore = clamp(data.openTargets?.diseases?.[0]?.score || 0, 0, 1);

  const tractabilityRows = data.openTargets?.target?.tractability || [];
  const tractabilityTrueCount = tractabilityRows.filter((row) => row.value === true).length;
  const tractabilityNorm = clamp(tractabilityTrueCount / 4, 0, 1);

  const maxDrugPhase = (data.openTargets?.drugs || []).reduce((max, row) => {
    const phase = Number(row.phase ?? row.drug?.maximumClinicalTrialPhase ?? 0);
    return Number.isFinite(phase) ? Math.max(max, phase) : max;
  }, 0);
  const drugNorm = clamp(maxDrugPhase / 4, 0, 1);

  const hasAlphaFold = Boolean(data.alphaFold?.modelId);
  const pdbNorm = clamp((data.uniprot?.pdbCount || 0) / 10, 0, 1);
  const structureNorm = clamp((hasAlphaFold ? 0.6 : 0) + pdbNorm * 0.4, 0, 1);

  const rawPoints = {
    disease: topDiseaseScore * weights.disease,
    tractability: tractabilityNorm * weights.tractability,
    drug: drugNorm * weights.drug,
    structure: structureNorm * weights.structure
  };

  const totalRaw = rawPoints.disease + rawPoints.tractability + rawPoints.drug + rawPoints.structure;
  const total = weightTotal > 0 ? Math.round((totalRaw / weightTotal) * 100) : 0;

  const high = clamp(Number(settings.thresholds.high) || 75, 1, 100);
  const medium = clamp(Number(settings.thresholds.medium) || 45, 1, high - 1);

  let band = "Exploratory";
  let color = "var(--risk)";
  let rationale =
    "Low evidence concentration. Keep this in discovery until stronger tractability or disease signal appears.";

  if (total >= high) {
    band = "High Actionability";
    color = "var(--good)";
    rationale =
      "Strong evidence density and translational maturity. Suitable for near-term prioritisation discussions.";
  } else if (total >= medium) {
    band = "Medium Actionability";
    color = "var(--warn)";
    rationale =
      "Mixed evidence profile. Worth prioritising if aligned with indication strategy and modality fit.";
  }

  const factorDisplay = {
    disease: (rawPoints.disease / weightTotal) * 100,
    tractability: (rawPoints.tractability / weightTotal) * 100,
    drug: (rawPoints.drug / weightTotal) * 100,
    structure: (rawPoints.structure / weightTotal) * 100
  };

  return {
    total,
    band,
    color,
    rationale,
    metrics: {
      topDiseaseScore,
      tractabilityTrueCount,
      maxDrugPhase,
      structureNorm,
      hasAlphaFold,
      weightTotal
    },
    breakdown: [
      `Disease evidence: ${factorDisplay.disease.toFixed(1)} points (top score ${(topDiseaseScore || 0).toFixed(3)})`,
      `Tractability: ${factorDisplay.tractability.toFixed(1)} points (${tractabilityTrueCount} true modalities)`,
      `Drug maturity: ${factorDisplay.drug.toFixed(1)} points (max phase ${maxDrugPhase})`,
      `Structure coverage: ${factorDisplay.structure.toFixed(1)} points (AlphaFold ${hasAlphaFold ? "yes" : "no"}, PDB refs ${data.uniprot?.pdbCount || 0})`
    ]
  };
}

function renderDossier(dossier) {
  elements.results.classList.remove("hidden");

  renderScore(dossier.scoreResult);
  renderSnapshot(dossier);
  renderDiseases(dossier.openTargets?.diseases || []);
  renderDrugs(dossier.openTargets?.drugs || []);
  renderStructure(dossier);
  renderSourceTrace(dossier.sourceTrace, dossier.warnings);

  elements.summaryText.textContent = dossier.summary;

  elements.saveDossierButton.disabled = false;
  elements.exportJsonButton.disabled = false;
  elements.exportMdButton.disabled = false;
}

function renderScore(scoreResult) {
  elements.scoreValue.textContent = String(scoreResult.total);
  elements.scoreBand.textContent = scoreResult.band;
  elements.scoreBand.style.color = scoreResult.color;
  elements.scoreRationale.textContent = scoreResult.rationale;

  elements.scoreBreakdown.innerHTML = "";
  for (const item of scoreResult.breakdown) {
    const line = document.createElement("li");
    line.textContent = item;
    elements.scoreBreakdown.append(line);
  }

  const circumference = 326;
  const offset = circumference - (scoreResult.total / 100) * circumference;
  elements.ringProgress.style.strokeDashoffset = String(offset);
  elements.ringProgress.style.stroke = scoreResult.color;
}

function renderSnapshot(dossier) {
  const uniprot = dossier.uniprot;
  const topDisease = dossier.openTargets?.diseases?.[0];
  const stats = [
    ["Gene", dossier.gene],
    ["UniProt", uniprot.accession],
    ["Ensembl", uniprot.ensemblId || "Unavailable"],
    ["Protein", uniprot.proteinName],
    ["Length", uniprot.sequenceLength ? `${uniprot.sequenceLength} aa` : "n/a"],
    [
      "Top disease",
      topDisease ? `${topDisease.disease?.name || "Unknown"} (${(topDisease.score || 0).toFixed(3)})` : "Unavailable"
    ]
  ];

  elements.snapshotGrid.innerHTML = "";
  for (const [key, value] of stats) {
    const card = document.createElement("div");
    card.className = "stat";

    const label = document.createElement("div");
    label.className = "k";
    label.textContent = key;

    const valueEl = document.createElement("div");
    valueEl.className = "v";
    valueEl.textContent = value;

    card.append(label, valueEl);
    elements.snapshotGrid.append(card);
  }
}

function renderDiseases(rows) {
  elements.diseaseTableWrap.innerHTML = "";

  if (!rows.length) {
    elements.diseaseTableWrap.append(emptyState("No disease associations returned."));
    return;
  }

  const table = createTable(
    ["Disease", "Score", "ID"],
    rows.map((row) => [
      row.disease?.name || "Unknown",
      (row.score || 0).toFixed(3),
      row.disease?.id || "n/a"
    ])
  );

  elements.diseaseTableWrap.append(table);
}

function renderDrugs(rows) {
  elements.drugTableWrap.innerHTML = "";

  if (!rows.length) {
    elements.drugTableWrap.append(emptyState("No known drugs returned."));
    return;
  }

  const table = createTable(
    ["Drug", "Phase", "Status"],
    rows.map((row) => [
      row.drug?.name || "Unknown",
      String(row.phase ?? row.drug?.maximumClinicalTrialPhase ?? "n/a"),
      row.status || "n/a"
    ])
  );

  elements.drugTableWrap.append(table);
}

function renderStructure(dossier) {
  elements.structureWrap.innerHTML = "";

  const description = document.createElement("p");
  description.className = "muted";
  description.textContent = truncate(
    `${dossier.uniprot.proteinName}. ${dossier.uniprot.functionComment}`,
    320
  );

  const links = document.createElement("div");
  links.className = "structure-row";
  links.append(
    linkButton("UniProt Entry", `https://www.uniprot.org/uniprotkb/${dossier.uniprot.accession}`),
    linkButton(
      "RCSB Search",
      `https://www.rcsb.org/search?query=${encodeURIComponent(dossier.uniprot.accession)}`
    )
  );

  if (dossier.alphaFold?.modelUrl) {
    links.append(linkButton("AlphaFold Structure", dossier.alphaFold.modelUrl));
  }

  if (dossier.alphaFold?.paeUrl) {
    links.append(linkButton("PAE Plot", dossier.alphaFold.paeUrl));
  }

  if (dossier.alphaFold?.plddtUrl) {
    links.append(linkButton("pLDDT", dossier.alphaFold.plddtUrl));
  }

  const coverage = document.createElement("p");
  coverage.className = "muted";
  coverage.textContent = `${dossier.uniprot.pdbCount} experimental PDB cross-references in UniProt.`;

  elements.structureWrap.append(description, links, coverage);
}

function renderSourceTrace(sourceTrace, warnings) {
  elements.sourceTrace.innerHTML = "";

  for (const item of sourceTrace) {
    const li = document.createElement("li");

    const source = document.createElement("span");
    source.className = "source";
    source.textContent = item.source;

    const detail = document.createElement("span");
    detail.className = "detail";
    detail.textContent = item.detail;

    li.append(source, detail);
    elements.sourceTrace.append(li);
  }

  for (const warning of warnings || []) {
    const li = document.createElement("li");

    const source = document.createElement("span");
    source.className = "source";
    source.textContent = "Warning";

    const detail = document.createElement("span");
    detail.className = "detail";
    detail.textContent = warning;

    li.append(source, detail);
    elements.sourceTrace.append(li);
  }
}

function renderBatchTable(dossiers, failures) {
  elements.batchTableWrap.innerHTML = "";

  if (!dossiers.length && !failures.length) {
    elements.batchTableWrap.append(emptyState("No dossiers created."));
    return;
  }

  const headers = ["Rank", "Gene", "Score", "Band", "Top Disease", "Action"];
  const rows = dossiers.map((dossier, index) => {
    const rank = String(index + 1);
    const topDisease = dossier.openTargets?.diseases?.[0]?.disease?.name || "Unavailable";

    const action = document.createElement("button");
    action.type = "button";
    action.className = "portfolio-action";
    action.dataset.action = "load-batch";
    action.dataset.id = dossier.id;
    action.textContent = "Load";

    return [
      rank,
      dossier.gene,
      String(dossier.scoreResult.total),
      createBandTag(dossier.scoreResult.band),
      topDisease,
      action
    ];
  });

  const table = createTable(headers, rows);
  elements.batchTableWrap.append(table);

  if (failures.length) {
    const failureText = document.createElement("p");
    failureText.className = "muted";
    failureText.textContent = `Failed: ${failures
      .map((failure) => `${failure.gene} (${failure.reason})`)
      .join("; ")}`;
    elements.batchTableWrap.append(failureText);
  }
}

function renderCompare(left, right) {
  elements.compareWrap.innerHTML = "";

  const scoreDelta = left.scoreResult.total - right.scoreResult.total;
  const better = scoreDelta >= 0 ? left : right;

  const leftCard = createCompareCard(left);
  const rightCard = createCompareCard(right);

  const delta = document.createElement("div");
  delta.className = "compare-delta";
  delta.textContent = `Score delta: ${left.gene} ${signed(scoreDelta)} vs ${right.gene}. Recommended first-pass pick: ${better.gene}.`;

  const grid = document.createElement("div");
  grid.className = "compare-grid";
  grid.append(leftCard, rightCard);

  elements.compareWrap.append(grid, delta);
}

function createCompareCard(dossier) {
  const card = document.createElement("article");
  card.className = "compare-card";

  const title = document.createElement("h3");
  title.textContent = `${dossier.gene} (${dossier.scoreResult.total}/100)`;

  const band = createBandTag(dossier.scoreResult.band);

  const meta = document.createElement("p");
  meta.className = "compare-meta";

  const topDisease = dossier.openTargets?.diseases?.[0];
  const topDrugPhase = dossier.scoreResult.metrics.maxDrugPhase;
  meta.textContent = [
    `Top disease: ${topDisease?.disease?.name || "Unavailable"}`,
    `Tractable modalities: ${dossier.scoreResult.metrics.tractabilityTrueCount}`,
    `Max drug phase: ${topDrugPhase}`,
    `AlphaFold: ${dossier.scoreResult.metrics.hasAlphaFold ? "yes" : "no"}`
  ].join(" | ");

  card.append(title, band, meta);
  return card;
}

function renderPortfolio() {
  elements.portfolioWrap.innerHTML = "";

  if (!state.portfolio.length) {
    elements.portfolioWrap.append(emptyState("No saved dossiers yet."));
    return;
  }

  const headers = ["Saved", "Gene", "Score", "Band", "Context", "Actions"];
  const rows = state.portfolio.map((item) => {
    const actions = document.createElement("div");
    actions.className = "actions-inline";

    const load = document.createElement("button");
    load.type = "button";
    load.className = "portfolio-action";
    load.dataset.action = "load";
    load.dataset.id = item.id;
    load.textContent = "Load";

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "portfolio-action";
    copy.dataset.action = "copy";
    copy.dataset.id = item.id;
    copy.textContent = "Copy Brief";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "portfolio-action";
    remove.dataset.action = "delete";
    remove.dataset.id = item.id;
    remove.textContent = "Delete";

    actions.append(load, copy, remove);

    return [
      new Date(item.savedAt || item.createdAt).toLocaleString(),
      item.gene,
      String(item.savedScore ?? item.scoreResult?.total ?? "n/a"),
      createBandTag(item.savedBand || item.scoreResult?.band || "Exploratory"),
      item.context || "-",
      actions
    ];
  });

  elements.portfolioWrap.append(createTable(headers, rows));
}

function renderSettingsControls(settings) {
  elements.weightDisease.value = String(settings.weights.disease);
  elements.weightTractability.value = String(settings.weights.tractability);
  elements.weightDrug.value = String(settings.weights.drug);
  elements.weightStructure.value = String(settings.weights.structure);
  elements.thresholdHigh.value = String(settings.thresholds.high);
  elements.thresholdMedium.value = String(settings.thresholds.medium);
  updateSettingsLabelsFromControls();
}

function updateSettingsLabelsFromControls() {
  elements.weightDiseaseValue.textContent = elements.weightDisease.value;
  elements.weightTractabilityValue.textContent = elements.weightTractability.value;
  elements.weightDrugValue.textContent = elements.weightDrug.value;
  elements.weightStructureValue.textContent = elements.weightStructure.value;

  const settings = readSettingsFromControls();
  const total =
    settings.weights.disease +
    settings.weights.tractability +
    settings.weights.drug +
    settings.weights.structure;

  const validation = validateSettings(settings);
  const thresholdText = `Band thresholds: high >= ${validation.thresholds.high}, medium >= ${validation.thresholds.medium}`;
  elements.weightsTotal.textContent = `Weight total: ${total}. ${thresholdText}.`;
}

function saveSettingsFromControls() {
  state.settings = validateSettings(readSettingsFromControls());
  persistSettings();
  renderSettingsControls(state.settings);

  if (state.currentDossier) {
    const rescored = rescoreDossier(state.currentDossier);
    state.currentDossier = rescored;
    renderDossier(rescored);
  }

  setStatus("Scoring settings saved.");
}

function resetSettings() {
  state.settings = deepClone(DEFAULT_SETTINGS);
  persistSettings();
  renderSettingsControls(state.settings);

  if (state.currentDossier) {
    const rescored = rescoreDossier(state.currentDossier);
    state.currentDossier = rescored;
    renderDossier(rescored);
  }

  setStatus("Scoring settings reset to defaults.");
}

function rescoreDossier(existingDossier) {
  const data = {
    uniprot: existingDossier.uniprot,
    openTargets: existingDossier.openTargets,
    alphaFold: existingDossier.alphaFold,
    sourceTrace: existingDossier.sourceTrace,
    warnings: existingDossier.warnings
  };

  const scoreResult = scoreTarget(data, state.settings);
  const summary = buildSummary({
    gene: existingDossier.gene,
    context: existingDossier.context,
    data,
    scoreResult
  });

  return {
    ...existingDossier,
    scoreResult,
    summary
  };
}

function handlePortfolioActions(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;

  if (!action || !id) {
    return;
  }

  const item = state.portfolio.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  if (action === "load") {
    const rescored = rescoreDossier(item);
    state.currentDossier = rescored;
    renderDossier(rescored);
    setStatus(`Loaded ${rescored.gene} from portfolio.`);
    return;
  }

  if (action === "copy") {
    navigator.clipboard
      .writeText(item.summary || "")
      .then(() => setStatus(`Copied brief for ${item.gene}.`))
      .catch(() => setStatus("Clipboard write failed.", "error"));
    return;
  }

  if (action === "delete") {
    state.portfolio = state.portfolio.filter((entry) => entry.id !== id);
    persistPortfolio();
    renderPortfolio();
    setStatus(`Deleted ${item.gene} from portfolio.`);
  }
}

function handleBatchActions(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  if (action !== "load-batch") {
    return;
  }

  const id = target.dataset.id;
  if (!id) {
    return;
  }

  const dossier = state.batchDossiers.get(id);
  if (!dossier) {
    return;
  }

  state.currentDossier = dossier;
  renderDossier(dossier);
  setStatus(`Loaded ${dossier.gene} from batch ranking.`);
}

function saveCurrentDossier() {
  if (!state.currentDossier) {
    return;
  }

  const savedItem = {
    ...state.currentDossier,
    savedAt: new Date().toISOString(),
    savedScore: state.currentDossier.scoreResult.total,
    savedBand: state.currentDossier.scoreResult.band
  };

  state.portfolio = [
    savedItem,
    ...state.portfolio.filter(
      (item) => !(item.gene === savedItem.gene && item.context === savedItem.context)
    )
  ].slice(0, MAX_PORTFOLIO_ITEMS);

  persistPortfolio();
  renderPortfolio();
  setStatus(`${savedItem.gene} saved to portfolio.`);
}

async function copySummary() {
  if (!state.currentDossier?.summary) {
    return;
  }

  try {
    await navigator.clipboard.writeText(state.currentDossier.summary);
    elements.copySummaryButton.textContent = "Copied";
    setTimeout(() => {
      elements.copySummaryButton.textContent = "Copy";
    }, 1200);
  } catch {
    setStatus("Clipboard write failed. Copy manually from the brief panel.", "error");
  }
}

function exportCurrentDossierJson() {
  if (!state.currentDossier) {
    return;
  }

  const fileName = `${state.currentDossier.gene.toLowerCase()}-dossier.json`;
  const content = JSON.stringify(state.currentDossier, null, 2);
  downloadFile(fileName, content, "application/json");
  setStatus(`Exported ${fileName}.`);
}

function exportCurrentDossierMarkdown() {
  if (!state.currentDossier) {
    return;
  }

  const dossier = state.currentDossier;
  const markdown = [
    `# Target Dossier: ${dossier.gene}`,
    `Generated: ${new Date(dossier.createdAt).toLocaleString()}`,
    "",
    `Actionability: **${dossier.scoreResult.total}/100 (${dossier.scoreResult.band})**`,
    "",
    "## Context",
    dossier.context || "None provided",
    "",
    "## Summary",
    dossier.summary,
    "",
    "## Breakdown",
    ...dossier.scoreResult.breakdown.map((item) => `- ${item}`),
    "",
    "## Sources",
    ...dossier.sourceTrace.map((item) => `- ${item.source}: ${item.detail}`)
  ].join("\n");

  const fileName = `${dossier.gene.toLowerCase()}-dossier.md`;
  downloadFile(fileName, markdown, "text/markdown");
  setStatus(`Exported ${fileName}.`);
}

function buildSummary({ gene, context, data, scoreResult }) {
  const topDisease = data.openTargets?.diseases?.[0];
  const topDrug = data.openTargets?.drugs?.[0]?.drug?.name || "Unavailable";

  return [
    `Target Dossier: ${gene}`,
    `Context: ${context || "none"}`,
    `Actionability: ${scoreResult.total}/100 (${scoreResult.band})`,
    `Protein: ${data.uniprot.proteinName} | UniProt ${data.uniprot.accession} | Ensembl ${data.uniprot.ensemblId || "n/a"}`,
    `Top disease: ${topDisease ? `${topDisease.disease?.name} (${(topDisease.score || 0).toFixed(3)})` : "Unavailable"}`,
    `Top drug signal: ${topDrug}`,
    `Structure: ${scoreResult.metrics.hasAlphaFold ? "AlphaFold model available" : "No AlphaFold model"}; PDB refs ${data.uniprot.pdbCount}`,
    "Scoring rationale:",
    ...scoreResult.breakdown.map((line) => `- ${line}`)
  ].join("\n");
}

function createBandTag(band) {
  const tag = document.createElement("span");
  tag.className = "portfolio-tag";

  if (band === "High Actionability") {
    tag.classList.add("good");
  } else if (band === "Medium Actionability") {
    tag.classList.add("warn");
  } else {
    tag.classList.add("risk");
  }

  tag.textContent = band;
  return tag;
}

function createTable(headers, rows) {
  const table = document.createElement("table");
  table.className = "data-table";

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");

  for (const header of headers) {
    const th = document.createElement("th");
    th.textContent = header;
    headRow.append(th);
  }

  head.append(headRow);

  const body = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");

    for (const cellValue of row) {
      const td = document.createElement("td");
      if (cellValue instanceof Node) {
        td.append(cellValue);
      } else {
        td.textContent = String(cellValue);
      }
      tr.append(td);
    }

    body.append(tr);
  }

  table.append(head, body);
  return table;
}

function emptyState(text) {
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = text;
  return p;
}

function linkButton(label, href) {
  const a = document.createElement("a");
  a.className = "link-button";
  a.href = href;
  a.textContent = label;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }

  return response.json();
}

function parseGeneList(input) {
  return [...new Set(input.split(/[\n,;\s]+/).map(normalizeGene).filter(Boolean))];
}

function normalizeGene(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function makeId(gene) {
  return `${gene}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function downloadFile(name, content, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function signed(value) {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text || "";
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function setStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", type === "error");
}

function readSettingsFromControls() {
  return {
    weights: {
      disease: Number(elements.weightDisease.value),
      tractability: Number(elements.weightTractability.value),
      drug: Number(elements.weightDrug.value),
      structure: Number(elements.weightStructure.value)
    },
    thresholds: {
      high: Number(elements.thresholdHigh.value),
      medium: Number(elements.thresholdMedium.value)
    }
  };
}

function validateSettings(settings) {
  const validated = {
    weights: {
      disease: clamp(Number(settings.weights.disease) || 0, 0, 100),
      tractability: clamp(Number(settings.weights.tractability) || 0, 0, 100),
      drug: clamp(Number(settings.weights.drug) || 0, 0, 100),
      structure: clamp(Number(settings.weights.structure) || 0, 0, 100)
    },
    thresholds: {
      high: clamp(Number(settings.thresholds.high) || 75, 1, 100),
      medium: clamp(Number(settings.thresholds.medium) || 45, 1, 99)
    }
  };

  if (validated.thresholds.medium >= validated.thresholds.high) {
    validated.thresholds.medium = Math.max(1, validated.thresholds.high - 1);
  }

  return validated;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) {
      return deepClone(DEFAULT_SETTINGS);
    }

    const parsed = JSON.parse(raw);
    return validateSettings(parsed);
  } catch {
    return deepClone(DEFAULT_SETTINGS);
  }
}

function persistSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  } catch {
    setStatus("Could not persist settings to local storage.", "error");
  }
}

function loadPortfolio() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.portfolio);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistPortfolio() {
  try {
    localStorage.setItem(STORAGE_KEYS.portfolio, JSON.stringify(state.portfolio));
  } catch {
    setStatus("Could not persist portfolio to local storage.", "error");
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
