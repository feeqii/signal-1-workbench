"use client";

import {
  type FormEvent,
  useId,
  useMemo,
  useState,
} from "react";
import type { InvestigationState } from "@/lib/investigation/schema";
import { parseVariant } from "@/lib/investigation/schema";
import {
  addPanelVariant,
  editPanel,
} from "@/lib/investigation/view-state";
import "./notebook.css";

type NotebookProps = {
  investigationId: string;
  state: InvestigationState;
  sequence: string;
  onChange: (next: InvestigationState) => void;
  onVariant: (variant: string) => void;
};

type Finding = InvestigationState["findings"][number];
type Experiment = InvestigationState["panel"][number];
type ExperimentRole = Experiment["role"];
type NotebookTab = "findings" | "experiments";

const roleLabels: Record<ExperimentRole, string> = {
  candidate: "Candidate",
  "positive-control": "Positive control",
  "negative-control": "Negative control",
};

const explain = (error: unknown) =>
  error instanceof Error ? error.message : "This entry could not be saved.";

function newExperiment(selectedVariant: string | null) {
  return {
    variant: selectedVariant ?? "",
    role: "candidate" as ExperimentRole,
    rationale: "",
    expectedObservation: "",
    replicates: "3",
  };
}

function selectionLabel(state: InvestigationState) {
  if (state.selectedVariant) return state.selectedVariant;
  if (state.selectedPositions.length === 1)
    return `Residue ${state.selectedPositions[0]}`;
  if (state.selectedPositions.length > 1)
    return `Residues ${state.selectedPositions.join(", ")}`;
  return "No molecular selection";
}

function validateFinding(draft: Pick<Finding, "title" | "claim">) {
  if (!draft.title.trim()) return "Add a short title before saving.";
  if (!draft.claim.trim()) return "Describe the claim before saving.";
  if (draft.title.trim().length > 160)
    return "The title must be 160 characters or fewer.";
  if (draft.claim.length > 6000)
    return "The claim must be 6,000 characters or fewer.";
  return "";
}

function validateExperimentText(draft: {
  rationale: string;
  expectedObservation: string;
}) {
  if (draft.rationale.length > 2000)
    return "The rationale must be 2,000 characters or fewer.";
  if (draft.expectedObservation.length > 2000)
    return "The expected observation must be 2,000 characters or fewer.";
  return "";
}

function validateReplicates(value: string) {
  const repeats = Number(value);
  return Number.isInteger(repeats) && repeats >= 1 && repeats <= 96
    ? ""
    : "Repeats must be a whole number from 1 to 96.";
}

function VariantFeedback({
  message,
  error,
}: {
  message: string;
  error: boolean;
}) {
  return (
    <p
      className="notebook-validation"
      data-tone={error ? "error" : "valid"}
      aria-live="polite"
    >
      {message}
    </p>
  );
}

function FindingEntry({
  finding,
  state,
  onChange,
}: {
  finding: Finding;
  state: InvestigationState;
  onChange: NotebookProps["onChange"];
}) {
  const [draft, setDraft] = useState(finding);
  const [error, setError] = useState("");

  function save(event: FormEvent) {
    event.preventDefault();
    const nextError = validateFinding(draft);
    if (nextError) {
      setError(nextError);
      return;
    }
    onChange({
      ...state,
      findings: state.findings.map((row) =>
        row.id === finding.id
          ? {
              ...draft,
              title: draft.title.trim(),
              claim: draft.claim.trim(),
              contradictoryEvidence: draft.contradictoryEvidence.trim(),
            }
          : row,
      ),
    });
    setError("");
  }

  const attachment = [
    finding.evidenceVariants.join(", "),
    finding.positions.length
      ? `residue${finding.positions.length === 1 ? "" : "s"} ${finding.positions.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <details
      className="notebook-entry"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setDraft(finding);
          setError("");
        }
      }}
    >
      <summary>
        <span className="notebook-entry-marker" aria-hidden="true" />
        <span className="notebook-entry-summary">
          <span className="notebook-entry-kicker">
            {finding.kind} · {attachment || "No selection attached"}
          </span>
          <strong>{finding.title}</strong>
          <span className="notebook-entry-preview">{finding.claim}</span>
        </span>
        <span className="notebook-disclosure">Open to edit</span>
      </summary>
      <form className="notebook-entry-form" onSubmit={save}>
        <div className="notebook-field-grid">
          <label>
            Title
            <input
              value={draft.title}
              maxLength={160}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </label>
          <label>
            Kind
            <select
              value={draft.kind}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  kind: event.target.value as Finding["kind"],
                })
              }
            >
              <option value="hypothesis">Hypothesis</option>
              <option value="observation">Observation</option>
            </select>
          </label>
        </div>
        <label>
          Claim
          <textarea
            rows={4}
            value={draft.claim}
            maxLength={6000}
            onChange={(event) =>
              setDraft({ ...draft, claim: event.target.value })
            }
          />
        </label>
        <label>
          Contradictory evidence
          <textarea
            rows={3}
            value={draft.contradictoryEvidence}
            maxLength={6000}
            placeholder="Evidence that would weaken this interpretation"
            onChange={(event) =>
              setDraft({
                ...draft,
                contradictoryEvidence: event.target.value,
              })
            }
          />
        </label>
        <div className="notebook-attachment notebook-attachment-saved">
          <span>Attached evidence</span>
          <strong>{attachment || "No selection attached"}</strong>
        </div>
        {error && (
          <p className="notebook-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="notebook-actions">
          <button className="notebook-primary" type="submit">
            Save changes
          </button>
          <button
            className="notebook-danger"
            type="button"
            onClick={() =>
              onChange({
                ...state,
                findings: state.findings.filter(
                  (row) => row.id !== finding.id,
                ),
              })
            }
          >
            Delete finding
          </button>
        </div>
      </form>
    </details>
  );
}

function ExperimentEntry({
  experiment,
  index,
  state,
  sequence,
  onChange,
  onVariant,
}: {
  experiment: Experiment;
  index: number;
  state: InvestigationState;
  sequence: string;
  onChange: NotebookProps["onChange"];
  onVariant: NotebookProps["onVariant"];
}) {
  const [draft, setDraft] = useState({
    ...experiment,
    replicates: String(experiment.replicates),
  });
  const [error, setError] = useState("");

  const variantFeedback = useMemo(() => {
    if (!draft.variant.trim())
      return { error: true, message: "Enter a variant or WT.", variant: "" };
    try {
      const { variant } = parseVariant(draft.variant, sequence);
      if (
        state.panel.some(
          (row, rowIndex) => rowIndex !== index && row.variant === variant,
        )
      ) {
        return {
          error: true,
          message: `${variant} is already in this experiment set.`,
          variant,
        };
      }
      return {
        error: false,
        message:
          variant === draft.variant.trim().toUpperCase()
            ? `${variant} is valid for this reference.`
            : `Will save as ${variant}.`,
        variant,
      };
    } catch (variantError) {
      return { error: true, message: explain(variantError), variant: "" };
    }
  }, [draft.variant, index, sequence, state.panel]);
  const repeatsError = validateReplicates(draft.replicates);

  function save(event: FormEvent) {
    event.preventDefault();
    if (variantFeedback.error) {
      setError(variantFeedback.message);
      return;
    }
    if (repeatsError) {
      setError(repeatsError);
      return;
    }
    const textError = validateExperimentText(draft);
    if (textError) {
      setError(textError);
      return;
    }
    try {
      const next = editPanel(state, index, {
        variant: variantFeedback.variant,
        role: draft.role,
        rationale: draft.rationale.trim(),
        expectedObservation: draft.expectedObservation.trim(),
        replicates: Number(draft.replicates),
      });
      onChange(next);
      setError("");
    } catch (editError) {
      setError(explain(editError));
    }
  }

  return (
    <details
      className="notebook-entry notebook-entry-experiment"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setDraft({
            ...experiment,
            replicates: String(experiment.replicates),
          });
          setError("");
        }
      }}
    >
      <summary>
        <span className="notebook-entry-marker" aria-hidden="true" />
        <span className="notebook-entry-summary">
          <span className="notebook-entry-kicker">
            {roleLabels[experiment.role]} · {experiment.replicates} repeats
          </span>
          <strong className="notebook-variant">{experiment.variant}</strong>
          <span className="notebook-entry-preview">
            {experiment.rationale ||
              experiment.expectedObservation ||
              "Rationale and expected observation not recorded"}
          </span>
        </span>
        <span className="notebook-disclosure">Open to edit</span>
      </summary>
      <form className="notebook-entry-form" onSubmit={save}>
        <div className="notebook-field-grid notebook-field-grid-experiment">
          <label>
            Variant
            <input
              className="notebook-mono"
              value={draft.variant}
              onChange={(event) =>
                setDraft({ ...draft, variant: event.target.value })
              }
              placeholder="G12D or WT"
              aria-invalid={variantFeedback.error}
            />
          </label>
          <label>
            Role
            <select
              value={draft.role}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  role: event.target.value as ExperimentRole,
                })
              }
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Repeats
            <input
              type="number"
              min={1}
              max={96}
              inputMode="numeric"
              value={draft.replicates}
              onChange={(event) =>
                setDraft({ ...draft, replicates: event.target.value })
              }
            />
            {repeatsError && (
              <small className="notebook-inline-error">{repeatsError}</small>
            )}
          </label>
        </div>
        <VariantFeedback
          message={variantFeedback.message}
          error={variantFeedback.error}
        />
        <label>
          Rationale
          <textarea
            rows={3}
            value={draft.rationale}
            maxLength={2000}
            placeholder="Why this variant or control discriminates between explanations"
            onChange={(event) =>
              setDraft({ ...draft, rationale: event.target.value })
            }
          />
        </label>
        <label>
          Expected observation
          <textarea
            rows={3}
            value={draft.expectedObservation}
            maxLength={2000}
            placeholder="What result would support the rationale"
            onChange={(event) =>
              setDraft({
                ...draft,
                expectedObservation: event.target.value,
              })
            }
          />
        </label>
        {error && (
          <p className="notebook-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="notebook-actions">
          <button
            className="notebook-primary"
            type="submit"
            disabled={variantFeedback.error || Boolean(repeatsError)}
          >
            Save changes
          </button>
          <button
            type="button"
            disabled={!variantFeedback.variant}
            onClick={() => onVariant(variantFeedback.variant)}
          >
            Inspect variant
          </button>
          <button
            className="notebook-danger"
            type="button"
            onClick={() =>
              onChange({
                ...state,
                panel: state.panel.filter((_, rowIndex) => rowIndex !== index),
              })
            }
          >
            Remove
          </button>
        </div>
      </form>
    </details>
  );
}

export function Notebook({
  investigationId,
  state,
  sequence,
  onChange,
  onVariant,
}: NotebookProps) {
  const tabsId = useId();
  const [tab, setTab] = useState<NotebookTab>("findings");
  const [findingFormOpen, setFindingFormOpen] = useState(false);
  const [findingTitle, setFindingTitle] = useState("");
  const [findingClaim, setFindingClaim] = useState("");
  const [findingKind, setFindingKind] =
    useState<Finding["kind"]>("hypothesis");
  const [findingContradiction, setFindingContradiction] = useState("");
  const [findingError, setFindingError] = useState("");
  const [experiment, setExperiment] = useState(() =>
    newExperiment(state.selectedVariant),
  );
  const [experimentDirty, setExperimentDirty] = useState(false);
  const [experimentError, setExperimentError] = useState("");

  const experimentDraft = experimentDirty
    ? experiment
    : { ...experiment, variant: state.selectedVariant ?? "" };

  const newVariantFeedback = useMemo(() => {
    if (!experimentDraft.variant.trim())
      return {
        error: true,
        message: state.selectedPositions.length
          ? "A residue selection is not a substitution. Enter a variant such as G12D, or WT."
          : "Enter a variant such as G12D, or WT.",
        variant: "",
      };
    try {
      const { variant } = parseVariant(experimentDraft.variant, sequence);
      if (state.panel.some((row) => row.variant === variant))
        return {
          error: true,
          message: `${variant} is already in this experiment set. Open it below to edit its repeats.`,
          variant,
        };
      return {
        error: false,
        message:
          variant === experimentDraft.variant.trim().toUpperCase()
            ? `${variant} is valid for this reference.`
            : `Will add as ${variant}.`,
        variant,
      };
    } catch (variantError) {
      return { error: true, message: explain(variantError), variant: "" };
    }
  }, [
    experimentDraft.variant,
    sequence,
    state.panel,
    state.selectedPositions.length,
  ]);

  function addFinding(event: FormEvent) {
    event.preventDefault();
    const finding = {
      id: crypto.randomUUID(),
      title: findingTitle,
      claim: findingClaim,
      kind: findingKind,
      positions: [...state.selectedPositions],
      evidenceVariants: state.selectedVariant ? [state.selectedVariant] : [],
      contradictoryEvidence: findingContradiction,
    };
    const nextError = validateFinding(finding);
    if (nextError) {
      setFindingError(nextError);
      return;
    }
    if (state.findings.length >= 100) {
      setFindingError("This notebook already contains 100 findings.");
      return;
    }
    onChange({
      ...state,
      findings: [
        ...state.findings,
        {
          ...finding,
          title: finding.title.trim(),
          claim: finding.claim.trim(),
          contradictoryEvidence: finding.contradictoryEvidence.trim(),
        },
      ],
    });
    setFindingTitle("");
    setFindingClaim("");
    setFindingContradiction("");
    setFindingError("");
    setFindingFormOpen(false);
  }

  function addExperiment(event: FormEvent) {
    event.preventDefault();
    if (newVariantFeedback.error) {
      setExperimentError(newVariantFeedback.message);
      return;
    }
    const textError = validateExperimentText(experimentDraft);
    if (textError) {
      setExperimentError(textError);
      return;
    }
    try {
      let next = addPanelVariant(
        state,
        experimentDraft.variant,
        sequence,
        experimentDraft.role,
      );
      next = editPanel(next, next.panel.length - 1, {
        rationale: experimentDraft.rationale.trim(),
        expectedObservation: experimentDraft.expectedObservation.trim(),
        replicates: Number(experimentDraft.replicates),
      });
      onChange(next);
      setExperiment(newExperiment(state.selectedVariant));
      setExperimentDirty(false);
      setExperimentError("");
    } catch (addError) {
      setExperimentError(explain(addError));
    }
  }

  const findingDisabled =
    !findingTitle.trim() ||
    !findingClaim.trim() ||
    state.findings.length >= 100;
  const experimentDisabled =
    newVariantFeedback.error ||
    Boolean(validateReplicates(experimentDraft.replicates)) ||
    state.panel.length >= 96;

  return (
    <section
      className="notebook"
      aria-label="Investigation notebook"
      data-investigation-id={investigationId}
    >
      <header className="notebook-header">
        <div>
          <span className="notebook-eyebrow">Research record</span>
          <h2>Notebook</h2>
        </div>
        <span className="notebook-total">
          {state.findings.length + state.panel.length} saved
        </span>
      </header>

      <div className="notebook-tabs" role="tablist" aria-label="Notebook">
        <button
          id={`${tabsId}-findings-tab`}
          type="button"
          role="tab"
          aria-selected={tab === "findings"}
          aria-controls={`${tabsId}-findings-panel`}
          onClick={() => setTab("findings")}
        >
          Findings <span>{state.findings.length}</span>
        </button>
        <button
          id={`${tabsId}-experiments-tab`}
          type="button"
          role="tab"
          aria-selected={tab === "experiments"}
          aria-controls={`${tabsId}-experiments-panel`}
          onClick={() => setTab("experiments")}
        >
          Experiments <span>{state.panel.length}</span>
        </button>
      </div>

      <div
        id={`${tabsId}-findings-panel`}
        className="notebook-panel"
        role="tabpanel"
        aria-labelledby={`${tabsId}-findings-tab`}
        hidden={tab !== "findings"}
      >
          <div className="notebook-panel-intro">
            <p>
              Record an interpretation with the active molecular selection
              attached as evidence.
            </p>
            <button
              className="notebook-primary"
              type="button"
              aria-expanded={findingFormOpen}
              onClick={() => setFindingFormOpen((open) => !open)}
            >
              {findingFormOpen ? "Close form" : "New finding"}
            </button>
          </div>

          {findingFormOpen && (
            <form className="notebook-new-form" onSubmit={addFinding}>
              <div className="notebook-form-heading">
                <span className="notebook-eyebrow">New finding</span>
                <p>Required fields are marked.</p>
              </div>
              <div className="notebook-field-grid">
                <label>
                  Title <span aria-hidden="true">*</span>
                  <input
                    autoFocus
                    value={findingTitle}
                    maxLength={160}
                    onChange={(event) => setFindingTitle(event.target.value)}
                  />
                </label>
                <label>
                  Kind
                  <select
                    value={findingKind}
                    onChange={(event) =>
                      setFindingKind(event.target.value as Finding["kind"])
                    }
                  >
                    <option value="hypothesis">Hypothesis</option>
                    <option value="observation">Observation</option>
                  </select>
                </label>
              </div>
              <label>
                Claim <span aria-hidden="true">*</span>
                <textarea
                  rows={4}
                  value={findingClaim}
                  maxLength={6000}
                  placeholder="What does the evidence suggest?"
                  onChange={(event) => setFindingClaim(event.target.value)}
                />
              </label>
              <label>
                Contradictory evidence
                <textarea
                  rows={3}
                  value={findingContradiction}
                  maxLength={6000}
                  placeholder="What observation would weaken this interpretation?"
                  onChange={(event) =>
                    setFindingContradiction(event.target.value)
                  }
                />
              </label>
              <div className="notebook-attachment">
                <span>Attach current selection</span>
                <strong>{selectionLabel(state)}</strong>
                <small>
                  {state.selectedVariant
                    ? `Variant and ${state.selectedPositions.length || "no"} linked residue${state.selectedPositions.length === 1 ? "" : "s"}`
                    : state.selectedPositions.length
                      ? "Residue context only; no variant will be inferred"
                      : "You can save this finding without a structure selection"}
                </small>
              </div>
              {findingError && (
                <p className="notebook-form-error" role="alert">
                  {findingError}
                </p>
              )}
              <button
                className="notebook-primary notebook-submit"
                type="submit"
                disabled={findingDisabled}
                title={
                  findingDisabled
                    ? state.findings.length >= 100
                      ? "A notebook supports up to 100 findings."
                      : "Add a title and claim to save this finding."
                    : undefined
                }
              >
                Add finding with selection
              </button>
              {findingDisabled && (
                <p className="notebook-action-hint">
                  {state.findings.length >= 100
                    ? "The 100-finding limit has been reached."
                    : "A title and claim are required to add the finding."}
                </p>
              )}
            </form>
          )}

          <div className="notebook-entry-list">
            {state.findings.length ? (
              state.findings.map((finding) => (
                <FindingEntry
                  key={finding.id}
                  finding={finding}
                  state={state}
                  onChange={onChange}
                />
              ))
            ) : (
              <div className="notebook-empty">
                <span aria-hidden="true">01</span>
                <h3>No findings recorded</h3>
                <p>
                  Select a residue or variant on the molecular canvas, then
                  capture the hypothesis or observation it prompted.
                </p>
              </div>
            )}
          </div>
      </div>

      <div
        id={`${tabsId}-experiments-panel`}
        className="notebook-panel"
        role="tabpanel"
        aria-labelledby={`${tabsId}-experiments-tab`}
        hidden={tab !== "experiments"}
      >
          <p className="notebook-panel-copy">
            Build a discriminating set with explicit controls, rationale,
            expected observations, and repeats.
          </p>
          <form className="notebook-new-form" onSubmit={addExperiment}>
            <div className="notebook-form-heading">
              <span className="notebook-eyebrow">New experiment</span>
              <p>Variants are checked against the KRAS reference.</p>
            </div>
            <div className="notebook-field-grid notebook-field-grid-experiment">
              <label>
                Variant
                <input
                  className="notebook-mono"
                  value={experimentDraft.variant}
                  placeholder="G12D or WT"
                  aria-invalid={newVariantFeedback.error}
                  onChange={(event) => {
                    setExperiment({
                      ...experimentDraft,
                      variant: event.target.value,
                    });
                    setExperimentDirty(true);
                  }}
                />
              </label>
              <label>
                Role
                <select
                  value={experimentDraft.role}
                  onChange={(event) => {
                    setExperiment({
                      ...experimentDraft,
                      role: event.target.value as ExperimentRole,
                    });
                    setExperimentDirty(true);
                  }}
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Repeats
                <input
                  type="number"
                  min={1}
                  max={96}
                  inputMode="numeric"
                  value={experimentDraft.replicates}
                  onChange={(event) => {
                    setExperiment({
                      ...experimentDraft,
                      replicates: event.target.value,
                    });
                    setExperimentDirty(true);
                  }}
                />
                {validateReplicates(experimentDraft.replicates) && (
                  <small className="notebook-inline-error">
                    {validateReplicates(experimentDraft.replicates)}
                  </small>
                )}
              </label>
            </div>
            <VariantFeedback
              message={newVariantFeedback.message}
              error={newVariantFeedback.error}
            />
            <label>
              Rationale
              <textarea
                rows={3}
                value={experimentDraft.rationale}
                maxLength={2000}
                placeholder="Why this variant or control belongs in the set"
                onChange={(event) => {
                  setExperiment({
                    ...experimentDraft,
                    rationale: event.target.value,
                  });
                  setExperimentDirty(true);
                }}
              />
            </label>
            <label>
              Expected observation
              <textarea
                rows={3}
                value={experimentDraft.expectedObservation}
                maxLength={2000}
                placeholder="What result would support the rationale"
                onChange={(event) => {
                  setExperiment({
                    ...experimentDraft,
                    expectedObservation: event.target.value,
                  });
                  setExperimentDirty(true);
                }}
              />
            </label>
            {experimentError && (
              <p className="notebook-form-error" role="alert">
                {experimentError}
              </p>
            )}
            <div className="notebook-actions">
              <button
                className="notebook-primary"
                type="submit"
                disabled={experimentDisabled}
                title={
                  experimentDisabled
                    ? state.panel.length >= 96
                      ? "An experiment set supports up to 96 variants."
                    : validateReplicates(experimentDraft.replicates) ||
                      newVariantFeedback.message
                    : undefined
                }
              >
                Add experiment
              </button>
              <button
                type="button"
                disabled={!newVariantFeedback.variant}
                onClick={() => onVariant(newVariantFeedback.variant)}
              >
                Inspect variant
              </button>
            </div>
            {experimentDisabled && (
              <p className="notebook-action-hint">
                {state.panel.length >= 96
                  ? "The 96-variant experiment limit has been reached."
                  : validateReplicates(experimentDraft.replicates) ||
                    newVariantFeedback.message}
              </p>
            )}
          </form>

          <div className="notebook-entry-list">
            {state.panel.length ? (
              state.panel.map((row, index) => (
                <ExperimentEntry
                  key={row.variant}
                  experiment={row}
                  index={index}
                  state={state}
                  sequence={sequence}
                  onChange={onChange}
                  onVariant={onVariant}
                />
              ))
            ) : (
              <div className="notebook-empty">
                <span aria-hidden="true">02</span>
                <h3>No experiments planned</h3>
                <p>
                  Add a measured variant, candidate, or control. A residue-only
                  selection stays a residue until you enter a substitution.
                </p>
              </div>
            )}
          </div>
      </div>
    </section>
  );
}
