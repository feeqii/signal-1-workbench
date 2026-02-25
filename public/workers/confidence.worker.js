function parsePlddt(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return [];
    }

    if (typeof payload[0] === "number") {
      return payload;
    }

    if (typeof payload[0] === "object" && payload[0] !== null) {
      return payload
        .map((row) => {
          if (typeof row.confidenceScore === "number") {
            return row.confidenceScore;
          }
          if (typeof row.plddt === "number") {
            return row.plddt;
          }
          return NaN;
        })
        .filter((value) => Number.isFinite(value));
    }
  }

  if (typeof payload === "object") {
    if (Array.isArray(payload.confidenceScore)) {
      return payload.confidenceScore.filter((value) => Number.isFinite(value));
    }

    if (Array.isArray(payload.plddt)) {
      return payload.plddt.filter((value) => Number.isFinite(value));
    }
  }

  return [];
}

function parsePae(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return [];
    }

    if (Array.isArray(payload[0])) {
      return payload;
    }

    if (payload[0] && Array.isArray(payload[0].predicted_aligned_error)) {
      return payload[0].predicted_aligned_error;
    }
  }

  if (payload && Array.isArray(payload.predicted_aligned_error)) {
    return payload.predicted_aligned_error;
  }

  return [];
}

self.onmessage = (event) => {
  const { plddtPayload, paePayload } = event.data || {};

  const plddtValues = parsePlddt(plddtPayload);
  const paeMatrix = parsePae(paePayload);

  const residueCount = plddtValues.length;
  const avgPlddt =
    residueCount > 0
      ? plddtValues.reduce((sum, value) => sum + value, 0) / residueCount
      : 0;

  const highConfidenceResidues = plddtValues.filter((value) => value >= 90).length;
  const lowConfidenceResidues = plddtValues.filter((value) => value < 50).length;

  let paeSum = 0;
  let paeCount = 0;
  let paeMax = 0;

  for (const row of paeMatrix) {
    if (!Array.isArray(row)) {
      continue;
    }

    for (const value of row) {
      if (!Number.isFinite(value)) {
        continue;
      }
      paeSum += value;
      paeCount += 1;
      if (value > paeMax) {
        paeMax = value;
      }
    }
  }

  const paeMean = paeCount ? paeSum / paeCount : 0;

  self.postMessage({
    avgPlddt,
    highConfidenceResidues,
    lowConfidenceResidues,
    paeMean,
    paeMax,
    residueCount
  });
};
