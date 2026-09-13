"""A substitution compatibility prior, not an assay predictor."""
from Bio.Align import substitution_matrices
from scientific.case_data import CASE_DIR, parse_variant


def score_variants(variants, reference):
    if not isinstance(variants,list) or not variants or len(variants)>10000:
        raise ValueError('Provide between 1 and 10000 variants')
    matrix = substitution_matrices.read(str(CASE_DIR / 'sources/BLOSUM62'))
    seen, scores = set(), []
    for variant in variants:
        canonical, _ = ('WT', []) if variant == 'WT' else parse_variant(variant,reference)
        if canonical in seen:
            raise ValueError('Duplicate variant aliases')
        seen.add(canonical)
        scores.append(dict(variant=canonical,score=0.0 if canonical == 'WT' else float(sum(matrix[p[0],p[-1]] for p in canonical.split(':')))))
    return dict(name='BLOSUM62 substitution compatibility prior',version='Henikoff and Henikoff 1992; Biopython 1.86 BLOSUM62',sourceUrl='https://doi.org/10.1073/pnas.89.22.10915',description='Sum of frozen published BLOSUM62 substitution entries in half-bit units. The precomputed case contains all 3,202 measured single substitutions; the worker also supports validated combinations. WT is an explicit no-substitution control with empty-sum score 0, not a fitted wild-type measurement. Higher scores indicate greater substitution compatibility in the source alignment statistics.',limitations=['Not a prediction of KRAS abundance, DARPin binding, folding energy, pathogenicity, or therapeutic response.','No new model training or calibration; no claimed KRAS predictive performance.','Multi-substitution scores are additive and omit epistasis, position-specific context and structural information.'],scores=scores)
