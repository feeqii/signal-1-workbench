#!/usr/bin/env python3
"""Rebuild deterministic case outputs from frozen public sources (offline)."""
import csv
import hashlib
import json
import math
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scientific.case_data import CASE_DIR, extract_cif_mapping, parse_variant
from scientific.compare import compare_structures
from scientific.baseline import score_variants

PG_URL='https://marks.hms.harvard.edu/proteingym/ProteinGym_v1.3/DMS_ProteinGym_substitutions.zip'
PAPER='https://doi.org/10.1038/s41586-023-06954-0'
RETRIEVED='2026-09-13'

def save(name,value):
    (CASE_DIR/name).write_text(json.dumps(value,indent=2,allow_nan=False)+'\n')

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    reference=''.join((CASE_DIR/'sources/P01116-2.fasta').read_text().splitlines()[1:])
    if len(reference)!=188 or hashlib.sha256(reference.encode()).hexdigest()!='9a0ed04ef46e15865a90f9dd0808d7d12c94746c66b0f41228aa2e62516ccbca':
        raise ValueError('Exact audited isoform sequence mismatch')
    metadata=json.loads((CASE_DIR/'sources/proteingym-reference-rows.json').read_text())
    assay_data=[]
    for entry in metadata:
        if entry['target_seq']!=reference:raise ValueError('Assay reference differs from UniProt P01116-2')
        scores={}
        with (CASE_DIR/'sources'/entry['DMS_filename']).open() as file:
            reader=csv.DictReader(file)
            columns=reader.fieldnames
            for row in reader:
                variant, positions=parse_variant(row['mutant'],reference)
                if variant in scores:raise ValueError('Duplicate variant aliases in source')
                mutated=list(reference)
                for part in variant.split(':'):mutated[int(part[1:-1])-1]=part[-1]
                if ''.join(mutated)!=row['mutated_sequence']:raise ValueError('Full mutated sequence mismatch')
                score=float(row['DMS_score'])
                if not math.isfinite(score):raise ValueError('Missing or nonfinite score')
                scores[variant]=score
        assay_data.append(scores)
    abundance,binding=assay_data
    variants=sorted(set(abundance)|set(binding),key=lambda v:(parse_variant(v,reference)[1],v))
    observations=[dict(variant=v,positions=parse_variant(v,reference)[1],abundance=abundance.get(v),binding=binding.get(v)) for v in variants]
    save('observations.json',observations)
    structures=[]; structure_audit={}
    for pdb,partner,nucleotide in [('5O2S','K27','GDP'),('5O2T','K55','GTPγS (GSP)')]:
        path=CASE_DIR/'sources'/f'{pdb}.cif'
        rows,audit=extract_cif_mapping(path,reference,'A')
        save(f'{pdb}-mapping.json',rows)
        structure_audit[pdb]=audit
        structures.append(dict(id=pdb,title=f'KRAS G12V · DARPin {partner} · {nucleotide}',pdbId=pdb,chainId='A',url=f'/case/kras/sources/{pdb}.cif',sha256=sha(path),mappingUrl=f'/case/kras/{pdb}-mapping.json',method=audit['method'],context=f'Experimental KRAS G12V residues 1–166, GSH tag; DARPin {partner}, {nucleotide}; label/auth chain A, entity 1, model 1; {audit["resolutionAngstrom"]} Å resolution. Different complex/crystal contexts, not a mutation-effect comparison.',coverage=[r['referencePosition'] for r in rows if r['ca'] is not None]))
    limitations=['Measurements are ProteinGym v1.3 curated yeast-growth fitness scores from Weng et al., not direct abundance concentrations or binding affinities.','BindingPCA depends on both abundance and interaction; subtracting the two scores is not a binding free energy.','ProteinGym files omit replicate-level measurements and errors; no error bars or statistical significance are inferred. Original Supplementary Table 4 contains errors but was not ingested.','Both structures carry G12V and truncate the full-length reference at residue 166. Nucleotide, partner and crystal contexts differ; structural displacement is descriptive, not mutation causality.','5O2T archive title says K27; Weng et al. Figure 4 identifies 5O2T as K55. Original deposited bytes are preserved.','Software validation is complete for this bounded mapping; independent expert biological review and prospective usefulness remain pending.']
    manifest=dict(schemaVersion=1,id='kras-k55',title='KRAS: abundance and DARPin K55 binding',question='Which KRAS substitutions show different abundance and DARPin K55 binding phenotypes, and what follow-up measurements could distinguish the explanations?',reference=dict(accession='P01116',isoform='P01116-2',taxon=9606,sequence=reference,sequenceHash=hashlib.sha256(reference.encode()).hexdigest()),assays=[dict(id=e['DMS_id'],name=name,description=description,units='dimensionless assay fitness (ProteinGym DMS_score)',direction='Higher means greater measured assay fitness; source directionality +1',sourceUrl=PG_URL) for e,name,description in zip(metadata,['AbundancePCA','BindingPCA · DARPin K55'],['Yeast growth coupled to KRAS cellular abundance through protein-fragment complementation.','Yeast growth coupled to KRAS–DARPin K55 interaction through protein-fragment complementation; abundance can also affect the outcome.'])],structures=structures,assets=[],provenance=[dict(source='Weng et al., Nature 626, 643–652 (2024); online 18 December 2023',url=PAPER,retrievedAt=RETRIEVED,license='CC BY 4.0'),dict(source='ProteinGym v1.3, original assay fitness curated into DMS_score',url='https://zenodo.org/records/15293562',retrievedAt=RETRIEVED,license='MIT (deposit); Weng underlying measurements attributed under CC BY 4.0'),dict(source='UniProt P01116-2',url='https://rest.uniprot.org/uniprotkb/P01116-2.fasta',retrievedAt=RETRIEVED,license='CC BY 4.0'),dict(source='Guillard et al., Nature Communications 8, 16111 (2017); archive 5O2S and 5O2T',url='https://doi.org/10.1038/ncomms16111',retrievedAt=RETRIEVED,license='wwPDB coordinates CC0'),dict(source='Henikoff and Henikoff (1992), BLOSUM62; distributed with Biopython 1.86',url='https://doi.org/10.1073/pnas.89.22.10915',retrievedAt=RETRIEVED,license='Biopython License Agreement (matrix has no separate header license); see frozen LICENSE.rst')],limitations=limitations)
    save('manifest.json',manifest)
    comparison=compare_structures('5O2S','5O2T')
    save('comparison.json',comparison)
    singles=[v for v in variants if ':' not in v]
    save('baseline.json',score_variants(singles,reference))
    import gemmi
    left=json.loads((CASE_DIR/'5O2S-mapping.json').read_text());right=json.loads((CASE_DIR/'5O2T-mapping.json').read_text())
    l={r['referencePosition']:r for r in left};r={r['referencePosition']:r for r in right}
    gfit=gemmi.superpose_positions([gemmi.Position(*l[p]['ca']) for p in comparison['positions']],[gemmi.Position(*r[p]['ca']) for p in comparison['positions']])
    audit=dict(referenceExactMatch=[e['target_seq']==reference for e in metadata],sequenceHash=manifest['reference']['sequenceHash'],assayCounts=[len(abundance),len(binding)],pairedCount=len(set(abundance)&set(binding)),unionCount=len(variants),abundanceOnly=len(set(abundance)-set(binding)),bindingOnly=len(set(binding)-set(abundance)),singleVariantCount=len(singles),duplicateAliases=0,fullMutatedSequenceValidation='Every source row exactly reconstructed from P01116-2 and listed substitutions',sourceColumns=columns,replicatesAndErrors='Absent from ingested ProteinGym CSVs; available in original paper Supplementary Table 4, not ingested',doiReconciliation=dict(proteingymReferences=[e['jo'] for e in metadata],correctPreprint='10.1101/2022.12.06.519122',published='10.1038/s41586-023-06954-0',evidence='Original authors github.com/lehner-lab/krasddpcams README links .519122; original paper PMC10866706 has published DOI. Binding row .519127 retained as upstream discrepancy.'),structures=structure_audit,independentSuperposition=dict(method='Gemmi 0.7.5 superpose_positions (QCP)',rmsd=gfit.rmsd,numpyRmsd=comparison['rmsd'],absoluteDifference=abs(gfit.rmsd-comparison['rmsd']),count=comparison['count']),mappingFixtureStatus='Software fixtures only; external expert review pending')
    save('audit.json',audit)
    for path in sorted(CASE_DIR.rglob('*')):
        if not path.is_file() or path.name=='manifest.json':continue
        rel=str(path.relative_to(CASE_DIR))
        url=PAPER;license='Derived from cited public sources; preserve individual attributions'
        if path.suffix=='.cif':url=f'https://files.rcsb.org/download/{path.name}';license='CC0'
        elif path.suffix=='.csv':url=PG_URL;license='ProteinGym deposit MIT; original Weng study CC BY 4.0'
        elif path.suffix=='.fasta':url='https://rest.uniprot.org/uniprotkb/P01116-2.fasta';license='CC BY 4.0'
        elif path.name.startswith('biopython') or path.name=='BLOSUM62':url='https://raw.githubusercontent.com/biopython/biopython/biopython-186/'+('LICENSE.rst' if path.name.startswith('biopython') else 'Bio/Align/substitution_matrices/data/BLOSUM62');license='Biopython License Agreement; frozen accompanying license'
        elif 'proteingym' in path.name: url='https://zenodo.org/records/15293562' if 'deposit' in path.name else 'https://raw.githubusercontent.com/OATML-Markslab/ProteinGym/main/reference_files/DMS_substitutions.csv';license='MIT'
        elif path.name.endswith('-mapping.json'):url=f'https://files.rcsb.org/download/{path.name[:4]}.cif';license='Derived from CC0 coordinates and CC BY 4.0 UniProt reference'
        elif path.name in ('observations.json','audit.json'):url=PG_URL;license='Derived from ProteinGym MIT and Weng CC BY 4.0; see provenance'
        elif path.name=='baseline.json':url='https://doi.org/10.1073/pnas.89.22.10915';license='Derived from BLOSUM62 distributed under Biopython License Agreement'
        manifest['assets'].append(dict(path=rel,sha256=sha(path),bytes=path.stat().st_size,sourceUrl=url,license=license))
    save('manifest.json',manifest)
    print(json.dumps({k:audit[k] for k in ['assayCounts','pairedCount','unionCount','singleVariantCount','independentSuperposition']},indent=2))

if __name__=='__main__':main()
