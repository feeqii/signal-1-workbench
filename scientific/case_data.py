"""Explicit sequence and coordinate identities for the frozen KRAS case."""
import json
import math
import re
from pathlib import Path

CASE_DIR = Path(__file__).resolve().parents[1] / 'public/case/kras'
AMINO_ACIDS = set('ACDEFGHIKLMNPQRSTVWY')


def parse_variant(variant, reference):
    if not isinstance(variant, str) or not variant:
        raise ValueError('A substitution variant is required')
    changes = {}
    for part in variant.split(':'):
        match = re.fullmatch(r'([A-Z])([1-9][0-9]*)([A-Z])', part)
        if not match:
            raise ValueError('Use substitutions such as G12D or G12D:Q61H')
        old, pos, new = match.group(1), int(match.group(2)), match.group(3)
        if old not in AMINO_ACIDS or new not in AMINO_ACIDS or old == new:
            raise ValueError('Only non-synonymous standard amino-acid substitutions are supported')
        if pos > len(reference) or reference[pos-1] != old:
            raise ValueError('Reference amino acid does not match at position ' + str(pos))
        if pos in changes:
            raise ValueError('Duplicate or conflicting substitutions at position ' + str(pos))
        changes[pos] = old + str(pos) + new
    positions = sorted(changes)
    return ':'.join(changes[p] for p in positions), positions


def map_residues(reference, rows):
    result, positions, labels, authors = [], set(), set(), set()
    for original in rows:
        row = dict(original)
        pos = row['referencePosition']
        if type(pos) is not int or pos < 1 or pos > len(reference) or row['referenceAA'] != reference[pos-1]:
            raise ValueError('Reference mapping mismatch')
        label = (row['labelChain'], row['labelSeq'])
        author = (row['authChain'], row['authSeq'], row['insertionCode'])
        if pos in positions or (row['labelSeq'] is not None and label in labels) or author in authors:
            raise ValueError('Duplicate reference, label, or author alias')
        if row['observedAA'] not in AMINO_ACIDS:
            raise ValueError('Unsupported observed amino acid')
        ca = row['ca']
        if ca is not None and (len(ca) != 3 or not all(isinstance(v, (float,int)) and math.isfinite(v) for v in ca)):
            raise ValueError('Coordinates must be finite triples')
        positions.add(pos); labels.add(label); authors.add(author)
        result.append(row)
    return sorted(result, key=lambda row: row['referencePosition'])


def read_json(name):
    return json.loads((CASE_DIR / name).read_text())


def load_structure(structure_id):
    manifest = read_json('manifest.json')
    entry = next((s for s in manifest['structures'] if s['id'] == structure_id), None)
    if entry is None:
        raise ValueError('Only curated structure IDs are supported')
    mapping = read_json(Path(entry['mappingUrl']).name)
    return entry, map_residues(manifest['reference']['sequence'], mapping)


def extract_cif_mapping(path, reference, label_chain):
    """Resolve archive chain/entity identities before joining source database alignment.

    This deliberately supports ungapped, equal-span archive mappings only. Other
    cases require explicit new mapping support, never an inferred residue offset.
    """
    from Bio.PDB.MMCIF2Dict import MMCIF2Dict
    from Bio.SeqUtils import seq1
    data = MMCIF2Dict(str(path))
    def table(prefix):
        keys=[key for key in data if key.startswith(prefix+'.')]
        return [dict(zip([k.split('.',1)[1] for k in keys],values)) for values in zip(*(data[k] for k in keys))]
    scheme=[r for r in table('_pdbx_poly_seq_scheme') if r['asym_id']==label_chain]
    if not scheme: raise ValueError('Unknown label chain')
    auth_chains={r['pdb_strand_id'] for r in scheme}
    entities={r['entity_id'] for r in scheme}
    if len(auth_chains)!=1 or len(entities)!=1: raise ValueError('Ambiguous chain/entity identity')
    auth_chain=next(iter(auth_chains)); entity=next(iter(entities))
    alignment=[r for r in table('_struct_ref_seq') if r['pdbx_strand_id']==auth_chain and r['pdbx_db_accession']=='P01116']
    if len(alignment)!=1: raise ValueError('Require a unique explicit P01116 archive alignment')
    alignment=alignment[0]
    lb,le,db,de=[int(alignment[k]) for k in ['seq_align_beg','seq_align_end','db_align_beg','db_align_end']]
    if le-lb!=de-db: raise ValueError('Gapped source alignment requires explicit correspondence')
    declared={int(r['pdbx_seq_db_seq_num']):(seq1(r['db_mon_id']),seq1(r['mon_id'])) for r in table('_struct_ref_seq_dif') if r['pdbx_pdb_strand_id']==auth_chain and r['pdbx_seq_db_seq_num'] not in ('?','.')}
    atoms={}
    for r in table('_atom_site'):
        if r['label_asym_id']!=label_chain or r['label_atom_id']!='CA' or r.get('pdbx_PDB_model_num','1')!='1':continue
        label=int(r['label_seq_id'])
        # Highest occupancy wins; ties prefer blank alternate location then lexical ID.
        choice=(float(r['occupancy']),r['label_alt_id'] in ('.','?',''),r['label_alt_id'])
        if label not in atoms or choice > atoms[label][0]:atoms[label]=(choice,r)
    rows, mutations=[] ,[]
    for r in scheme:
        label=int(r['seq_id'])
        if not lb<=label<=le:continue
        pos=db+label-lb
        observed=seq1(r['mon_id'])
        expected=reference[pos-1]
        if observed!=expected:
            if declared.get(pos)!=(expected,observed):raise ValueError('Undeclared source sequence mismatch')
            mutations.append(f'{expected}{pos}{observed}')
        atom=atoms.get(label)
        if atom:
            atom=atom[1]
            if (atom['auth_asym_id']!=auth_chain or seq1(atom['label_comp_id'])!=observed
                or atom['label_entity_id']!=entity or int(atom['auth_seq_id'])!=int(r['pdb_seq_num'])
                or ('' if atom['pdbx_PDB_ins_code'] in ('.','?') else atom['pdbx_PDB_ins_code']) != ('' if r['pdb_ins_code'] in ('.','?') else r['pdb_ins_code'])):
                raise ValueError('Atom identity mismatch')
        rows.append(dict(referencePosition=pos,referenceAA=expected,labelChain=label_chain,authChain=auth_chain,labelSeq=label,authSeq=int(r['pdb_seq_num']),insertionCode='' if r['pdb_ins_code'] in ('.','?') else r['pdb_ins_code'],observedAA=observed,ca=[float(atom[k]) for k in ['Cartn_x','Cartn_y','Cartn_z']] if atom else None))
    rows=map_residues(reference,rows)
    mapped={r['referencePosition'] for r in rows}
    meta=dict(labelChain=label_chain,authChain=auth_chain,entityId=entity,sourceAlignment=alignment,constructMutations=mutations,unresolved=[r['referencePosition'] for r in rows if r['ca'] is None],outsideConstruct=[p for p in range(1,len(reference)+1) if p not in mapped],ligands=sorted({r['mon_id'] for r in table('_pdbx_nonpoly_scheme') if r['mon_id']!='HOH'}),depositedTitle=data['_struct.title'][0],method=data['_exptl.method'][0],resolutionAngstrom=float(data['_refine.ls_d_res_high'][0]),mappingMethod='mmCIF _struct_ref_seq P01116 alignment joined through _pdbx_poly_seq_scheme; full construct identity checked with declared _struct_ref_seq_dif mutations; chain A model 1; highest occupancy CA')
    return rows,meta
