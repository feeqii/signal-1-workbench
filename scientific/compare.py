"""Proper rigid Cα fit. Coordinates follow column-vector convention."""
import numpy as np
from scientific.case_data import load_structure, read_json


def superpose(left, right):
    left, right = np.asarray(left, dtype=float), np.asarray(right, dtype=float)
    if left.ndim != 2 or left.shape != right.shape or left.shape[1:] != (3,) or len(left) < 3:
        raise ValueError('At least three corresponding Cα atoms are required')
    if not np.isfinite(left).all() or not np.isfinite(right).all():
        raise ValueError('Non-finite coordinates')
    lc, rc = left.mean(axis=0), right.mean(axis=0)
    l, r = left-lc, right-rc
    if np.linalg.matrix_rank(l, tol=1e-8) < 2 or np.linalg.matrix_rank(r, tol=1e-8) < 2:
        raise ValueError('Collinear points do not determine a unique rigid fit')
    u, _, vt = np.linalg.svd(r.T @ l)
    correction = np.eye(3)
    correction[-1,-1] = np.linalg.det(u @ vt)
    rotation = (u @ correction @ vt).T
    translation = lc - rotation @ rc
    distances = np.linalg.norm((rotation @ right.T).T + translation-left, axis=1)
    return dict(rotation=rotation.tolist(), translation=translation.tolist(), rmsd=float(np.sqrt(np.mean(distances**2))), distances=distances.tolist())


def compare_structures(left_id, right_id, positions=None):
    if positions == []:
        positions = None
    left_entry, left_rows = load_structure(left_id)
    right_entry, right_rows = load_structure(right_id)
    reference = read_json('manifest.json')['reference']['sequence']
    if positions is not None:
        if not isinstance(positions,list) or not positions or len(set(positions)) != len(positions) or any(type(p) is not int or not 1 <= p <= len(reference) for p in positions):
            raise ValueError('Positions must be distinct reference residue numbers')
    scope = sorted(positions) if positions is not None else list(range(1,len(reference)+1))
    left, right = {r['referencePosition']:r for r in left_rows}, {r['referencePosition']:r for r in right_rows}
    included, exclusions = [], []
    for p in scope:
        if p not in left or p not in right:
            exclusions.append(f'{p}: outside one or both mapped constructs')
        elif left[p]['ca'] is None or right[p]['ca'] is None:
            exclusions.append(f'{p}: unresolved Cα in one or both structures')
        else:
            included.append(p)
    fit = superpose([left[p]['ca'] for p in included],[right[p]['ca'] for p in included])
    return dict(schemaVersion=1,leftId=left_id,rightId=right_id,kind='descriptive experimental structure comparison',atom='CA',units='angstrom',count=len(included),rmsd=fit['rmsd'],coverage=len(included)/len(reference),rotation=fit['rotation'],translation=fit['translation'],positions=included,displacements=[dict(position=p,distance=d) for p,d in zip(included,fit['distances'])],exclusions=exclusions,fitScope='Selected reference positions' if positions is not None else 'All shared observed reference Cα positions; full 188-residue reference coverage denominator',inputHashes=[left_entry['sha256'],right_entry['sha256']],algorithm='Kabsch SVD, determinant +1; column vector: mapped = rotation @ right + translation; numpy 2.4.3')
