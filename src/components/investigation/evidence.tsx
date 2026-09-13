"use client";
import { useMemo, useState } from "react";
import { filterObservations } from "@/lib/investigation/view-state";
import type { Comparison, Observation } from "@/lib/investigation/schema";
export function Evidence({
  observations,
  comparison,
  selectedVariant,
  positions,
  onVariant,
  onPosition,
}: {
  observations: Observation[];
  comparison: Comparison;
  selectedVariant: string | null;
  positions: number[];
  onVariant: (variant: string) => void;
  onPosition: (position: number) => void;
}) {
  const [tab, setTab] = useState("paired"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [onlySelected, setOnlySelected] = useState(false);
  const filtered = useMemo(
    () => filterObservations(observations, search, positions, onlySelected),
    [observations, search, onlySelected, positions],
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
  return (
    <section
      className="evidence-dock"
      aria-label="Linked experimental evidence"
    >
      <div className="dock-heading">
        <h2>Evidence</h2>
        <div className="tabs">
          {[
            ["paired", "Paired assays"],
            ["table", "Variant table"],
            ["displacement", "Displacement"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="evidence-filter">
        <input
          aria-label="Filter variants"
          placeholder="Find a variant · G12D"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <label className="inline-label">
          <input
            type="checkbox"
            checked={onlySelected}
            onChange={(e) => {
              setOnlySelected(e.target.checked);
              setPage(0);
            }}
          />
          Selected residues only
        </label>
        <span>{filtered.length.toLocaleString()} variants</span>
      </div>
      {tab === "paired" && (
        <>
          <svg
            className="assay-plot"
            viewBox="0 0 660 246"
            role="img"
            aria-label="Paired abundance versus DARPin K55 binding fitness plot"
          >
            <line x1="56" y1="202" x2="606" y2="202" />
            <line x1="56" y1="32" x2="56" y2="202" />
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <text x={56 + t * 550} y="217" textAnchor="middle">
                  {(extent.minX + t * (extent.maxX - extent.minX)).toFixed(1)}
                </text>
                <text x="49" y={206 - t * 170} textAnchor="end">
                  {(extent.minY + t * (extent.maxY - extent.minY)).toFixed(1)}
                </text>
              </g>
            ))}
            <text x="335" y="240" textAnchor="middle">
              Abundance fitness score (unitless)
            </text>
            <text transform="translate(14 125) rotate(-90)" textAnchor="middle">
              K55 binding fitness (unitless)
            </text>
            {points.map((o) => (
              <circle
                key={o.variant}
                cx={x(o.abundance!)}
                cy={y(o.binding!)}
                r={o.variant === selectedVariant ? 5 : 2.4}
                className={
                  o.variant === selectedVariant ? "selected-dot" : "assay-dot"
                }
                onClick={() => onVariant(o.variant)}
              >
                <title>
                  {o.variant}: abundance {o.abundance?.toFixed(3)}, binding{" "}
                  {o.binding?.toFixed(3)}
                </title>
              </circle>
            ))}
          </svg>
          <p className="caption">
            {paired.length.toLocaleString()} paired observations. Showing{" "}
            {points.length.toLocaleString()} evenly sampled rows
            {selectedVariant ? " plus the selected variant when paired" : ""}.
            Use the searchable table for every variant. Measured fitness, not
            clinical effect.
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
                {filtered.slice(safePage * 40, (safePage + 1) * 40).map((o) => (
                  <tr
                    key={o.variant}
                    data-selected={o.variant === selectedVariant}
                  >
                    <td>
                      <button
                        className="text-button mono"
                        onClick={() => onVariant(o.variant)}
                      >
                        {o.variant}
                      </button>
                    </td>
                    <td>{o.abundance?.toFixed(3) ?? "Not measured"}</td>
                    <td>{o.binding?.toFixed(3) ?? "Not measured"}</td>
                    <td>{o.positions.join(", ") || "WT"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              Previous
            </button>
            <span>
              Page {safePage + 1} / {pages} · unitless fitness
            </span>
            <button
              disabled={safePage === pages - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
      {tab === "displacement" && (
        <>
          <div className="displacements">
            {comparison.displacements.map((d) => (
              <button
                key={d.position}
                title={`Reference residue ${d.position}: ${d.distance.toFixed(3)} Å`}
                aria-label={`Residue ${d.position}, displacement ${d.distance.toFixed(3)} angstrom`}
                className={positions.includes(d.position) ? "selected" : ""}
                style={{
                  height: `${Math.max(3, (d.distance / Math.max(...comparison.displacements.map((row) => row.distance), 1)) * 150)}px`,
                }}
                onClick={() => onPosition(d.position)}
              />
            ))}
          </div>
          <div className="axis-label">
            Reference residue {comparison.displacements[0]?.position}–
            {comparison.displacements.at(-1)?.position} → · Cα displacement, 0–
            {Math.max(
              ...comparison.displacements.map((row) => row.distance),
              0,
            ).toFixed(2)}{" "}
            Å
          </div>
          <p className="caption">
            After the declared rigid fit. Binder and nucleotide context differ
            between structures.
          </p>
        </>
      )}
    </section>
  );
}
