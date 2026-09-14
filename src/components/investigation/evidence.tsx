"use client";

import React, { useId, useMemo, useState } from "react";
import { evidenceSelection, filterObservations } from "@/lib/investigation/view-state";
import type { Comparison, Observation } from "@/lib/investigation/schema";
import "./evidence.css";

const assayTabs = [
  ["paired", "Paired assays"],
  ["table", "Variant table"],
  ["displacement", "Displacement"],
] as const;

type AssayTab = (typeof assayTabs)[number][0];

export function Evidence({
  observations,
  comparison,
  selectedVariant,
  positions,
  onVariant,
  onPosition,
  onClose,
}: {
  observations: Observation[];
  comparison: Comparison;
  selectedVariant: string | null;
  positions: number[];
  onVariant: (variant: string) => void;
  onPosition: (position: number) => void;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<AssayTab>("paired"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [onlySelected, setOnlySelected] = useState(false);
  const componentId = useId();
  const normalizedSearch = search.trim().toUpperCase();
  const filtered = useMemo(
    () => filterObservations(observations, search, positions, onlySelected),
    [observations, search, onlySelected, positions],
  );
  const exactMatch = useMemo(
    () =>
      normalizedSearch
        ? filtered.find((row) => row.variant.toUpperCase() === normalizedSearch)
        : undefined,
    [filtered, normalizedSearch],
  );
  const selectedObservation = useMemo(
    () => observations.find((row) => row.variant === selectedVariant),
    [observations, selectedVariant],
  );
  const paired = useMemo(
    () => filtered.filter((o) => o.abundance !== null && o.binding !== null),
    [filtered],
  );
  const points = useMemo(() => {
    const stride = Math.max(1, Math.ceil(paired.length / 1500));
    const sample = paired.filter((_, i) => i % stride === 0);
    const selected = paired.find((o) => o.variant === selectedVariant);
    if (selected && !sample.includes(selected)) sample.push(selected);
    return sample;
  }, [paired, selectedVariant]);
  const extent = useMemo(() => {
    const xs = paired.map((o) => o.abundance!),
      ys = paired.map((o) => o.binding!);
    return {
      minX: Math.min(-1, ...xs),
      maxX: Math.max(1, ...xs),
      minY: Math.min(-1, ...ys),
      maxY: Math.max(1, ...ys),
    };
  }, [paired]);
  const x = (v: number) =>
      56 + ((v - extent.minX) / (extent.maxX - extent.minX)) * 550,
    y = (v: number) =>
      202 - ((v - extent.minY) / (extent.maxY - extent.minY)) * 170;
  const pages = Math.max(1, Math.ceil(filtered.length / 40)),
    safePage = Math.min(page, pages - 1);
  const currentTabIndex = assayTabs.findIndex(([id]) => id === tab);
  const panelId = `${componentId}-assay-panel`;

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    let nextIndex = currentTabIndex;
    if (event.key === "ArrowRight") nextIndex = (currentTabIndex + 1) % assayTabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentTabIndex - 1 + assayTabs.length) % assayTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = assayTabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = assayTabs[nextIndex][0];
    setTab(nextTab);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-assay-tab="${nextTab}"]`)
      ?.focus();
  }

  return (
    <section className="evidence-dock" aria-labelledby={`${componentId}-assay-heading`}>
      <div className="dock-heading">
        <div>
          <span className="eyebrow">Linked experimental evidence</span>
          <h2 id={`${componentId}-assay-heading`}>Assay explorer</h2>
        </div>
        {onClose && (
          <button type="button" className="assay-close" onClick={onClose} aria-label="Close assays">
            Close assays
          </button>
        )}
      </div>

      <div className="assay-toolbar">
        <div className="tabs assay-tabs" role="tablist" aria-label="Assay explorer views">
          {assayTabs.map(([id, label]) => (
            <button
              key={id}
              id={`${componentId}-assay-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={panelId}
              tabIndex={tab === id ? 0 : -1}
              data-assay-tab={id}
              onClick={() => setTab(id)}
              onKeyDown={handleTabKeyDown}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="evidence-filter">
          <label className="assay-search">
            <span>Variant search</span>
            <input
              aria-describedby={`${componentId}-search-status`}
              placeholder="Exact variant, e.g. G12D"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className="inline-label">
            <input
              type="checkbox"
              checked={onlySelected}
              disabled={positions.length === 0 && !onlySelected}
              onChange={(event) => {
                setOnlySelected(event.target.checked);
                setPage(0);
              }}
            />
            Selected residues only
          </label>
          <span id={`${componentId}-search-status`} className="assay-result-count" role="status">
            {filtered.length.toLocaleString()} variants
            {normalizedSearch && (exactMatch ? ` · exact match ${exactMatch.variant}` : " · no exact match")}
          </span>
          {exactMatch && exactMatch.variant !== selectedVariant && (
            <button
              type="button"
              className="text-button mono assay-exact-match"
              onClick={() => onVariant(exactMatch.variant)}
              aria-label={`Select exact variant ${exactMatch.variant}`}
            >
              Select {exactMatch.variant}
            </button>
          )}
        </div>
      </div>

      {positions.length > 0 && (
        <p className="caption assay-legend">
          Green marks selected residues. Amber marks the exact selected variant.
        </p>
      )}

      <div
        id={panelId}
        className="assay-panel"
        role="tabpanel"
        aria-labelledby={`${componentId}-assay-tab-${tab}`}
        tabIndex={0}
      >
        {tab === "paired" && (
          <>
            <div className="assay-visual">
              {paired.length > 0 ? (
                <svg
                  className="assay-plot"
                  viewBox="0 0 660 246"
                  role="img"
                  aria-label="Paired abundance versus DARPin K55 binding fitness plot"
                >
                  <line x1="56" y1="202" x2="606" y2="202" />
                  <line x1="56" y1="32" x2="56" y2="202" />
                  {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
                    <g key={tick}>
                      <text x={56 + tick * 550} y="217" textAnchor="middle">
                        {(extent.minX + tick * (extent.maxX - extent.minX)).toFixed(1)}
                      </text>
                      <text x="49" y={206 - tick * 170} textAnchor="end">
                        {(extent.minY + tick * (extent.maxY - extent.minY)).toFixed(1)}
                      </text>
                    </g>
                  ))}
                  <text x="335" y="240" textAnchor="middle">
                    Abundance fitness score (unitless)
                  </text>
                  <text transform="translate(14 125) rotate(-90)" textAnchor="middle">
                    K55 binding fitness (unitless)
                  </text>
                  {points.map((observation) => {
                    const selection = evidenceSelection(observation, selectedVariant, positions);
                    return (
                      <circle
                        key={observation.variant}
                        cx={x(observation.abundance!)}
                        cy={y(observation.binding!)}
                        r={observation.variant === selectedVariant ? 5 : 2.4}
                        className={
                          selection === "exact"
                            ? "selected-dot"
                            : selection === "residue"
                              ? "linked-dot"
                              : "assay-dot"
                        }
                        onClick={() => onVariant(observation.variant)}
                      >
                        <title>{`${observation.variant}: abundance ${observation.abundance?.toFixed(3)}, binding ${observation.binding?.toFixed(3)}`}</title>
                      </circle>
                    );
                  })}
                </svg>
              ) : (
                <div className="assay-empty" role="status">
                  No paired abundance and K55 binding measurements match these filters.
                </div>
              )}

              {selectedObservation && (
                <aside className="selected-assay-readout" aria-label={`Selected variant ${selectedObservation.variant}`}>
                  <span>Selected variant</span>
                  <strong className="mono">{selectedObservation.variant}</strong>
                  <dl>
                    <div>
                      <dt>Abundance</dt>
                      <dd>{selectedObservation.abundance?.toFixed(3) ?? "Not measured"}</dd>
                    </div>
                    <div>
                      <dt>K55 binding</dt>
                      <dd>{selectedObservation.binding?.toFixed(3) ?? "Not measured"}</dd>
                    </div>
                  </dl>
                  <small>Unitless fitness scores</small>
                </aside>
              )}
            </div>
            <p className="caption assay-disclosure">
              {paired.length.toLocaleString()} paired observations. Showing {points.length.toLocaleString()} evenly sampled rows
              {selectedVariant ? " plus the selected variant when it matches these filters and has both measurements" : ""}.
              Use the searchable table for every variant. These are measured fitness scores, not clinical effects.
            </p>
          </>
        )}

        {tab === "table" && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>Abundance</th>
                    <th>K55 binding</th>
                    <th>Positions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="assay-table-empty">
                        No variants match these filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.slice(safePage * 40, (safePage + 1) * 40).map((observation) => (
                      <tr
                        key={observation.variant}
                        data-selected={observation.variant === selectedVariant}
                        data-linked={evidenceSelection(observation, selectedVariant, positions) === "residue"}
                      >
                        <td>
                          <button
                            type="button"
                            className="text-button mono"
                            onClick={() => onVariant(observation.variant)}
                            aria-label={`Select variant ${observation.variant}`}
                          >
                            {observation.variant}
                          </button>
                        </td>
                        <td>{observation.abundance?.toFixed(3) ?? "Not measured"}</td>
                        <td>{observation.binding?.toFixed(3) ?? "Not measured"}</td>
                        <td>{observation.positions.join(", ") || "WT"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                aria-label="Previous variant table page"
              >
                Previous
              </button>
              <span>
                Page {safePage + 1} / {pages} · unitless fitness
              </span>
              <button
                type="button"
                disabled={safePage === pages - 1}
                onClick={() => setPage(safePage + 1)}
                aria-label="Next variant table page"
              >
                Next
              </button>
            </div>
          </>
        )}

        {tab === "displacement" && (
          <>
            {comparison.displacements.length > 0 ? (
              <>
                <div className="displacements" aria-label="C alpha displacement by reference residue">
                  {comparison.displacements.map((displacement) => (
                    <button
                      type="button"
                      key={displacement.position}
                      title={`Reference residue ${displacement.position}: ${displacement.distance.toFixed(3)} Å`}
                      aria-label={`Select residue ${displacement.position}, displacement ${displacement.distance.toFixed(3)} angstrom`}
                      className={positions.includes(displacement.position) ? "selected" : ""}
                      style={{
                        height: `${Math.max(
                          3,
                          (displacement.distance /
                            Math.max(...comparison.displacements.map((row) => row.distance), 1)) *
                            150,
                        )}px`,
                      }}
                      onClick={() => onPosition(displacement.position)}
                    />
                  ))}
                </div>
                <div className="axis-label">
                  Reference residue {comparison.displacements[0]?.position}–
                  {comparison.displacements.at(-1)?.position} → · Cα displacement, 0–
                  {Math.max(...comparison.displacements.map((row) => row.distance), 0).toFixed(2)} Å
                </div>
              </>
            ) : (
              <div className="assay-empty" role="status">
                No displacement values are available for this comparison.
              </div>
            )}
            <p className="caption assay-disclosure">
              After the declared rigid fit. Binder and nucleotide context differ between structures.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
