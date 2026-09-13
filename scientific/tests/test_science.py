"""Software fixtures, not externally reviewed biological mapping evidence."""
import importlib.util
import unittest

class Availability(unittest.TestCase):
    def test_required_scientific_behaviors_exist(self):
        for name in ('case_data', 'compare', 'baseline', 'worker'):
            self.assertIsNotNone(importlib.util.find_spec('scientific.' + name), name + ' is not implemented')

try:
    from scientific.case_data import parse_variant, map_residues
    from scientific.compare import superpose
    from scientific.baseline import score_variants
except ImportError:
    parse_variant = None

@unittest.skipIf(parse_variant is None, 'Behaviors not implemented yet')
class ScienceTests(unittest.TestCase):
    def test_variant_validation(self):
        self.assertEqual(parse_variant('G3D:A1V', 'ACGTA'), ('A1V:G3D', [1,3]))
        for variant in ['M1V','A1V:A1G','A1V:A1V','A0G','A6G','A1A','A1*','a1v','A1V, G3D']:
            with self.subTest(variant=variant), self.assertRaises(ValueError):
                parse_variant(variant, 'ACGTA')

    def test_thirty_mapping_edge_fixtures(self):
        # Five literal positions in each of six edge classes; mapping expectations
        # intentionally do not derive from the production mapper.
        reference = 'ACDEF'
        for pos, aa in [(1,'A'),(2,'C'),(3,'D'),(4,'E'),(5,'F')]:
            for kind in ['standard','author_offset','insertion','unresolved','construct_mutation','chain_identity']:
                row = dict(referencePosition=pos, referenceAA=aa, labelChain='A',authChain='A',labelSeq=pos,authSeq=pos,insertionCode='',observedAA=aa,ca=[1.,2.,3.])
                expected = (pos,aa,'A','A',pos,pos,'',aa,[1.,2.,3.])
                if kind == 'author_offset':
                    row['authSeq']=pos+100; expected=(pos,aa,'A','A',pos,pos+100,'',aa,[1.,2.,3.])
                if kind == 'insertion':
                    row['insertionCode']='B'; expected=(pos,aa,'A','A',pos,pos,'B',aa,[1.,2.,3.])
                if kind == 'unresolved':
                    row['ca']=None; expected=(pos,aa,'A','A',pos,pos,'',aa,None)
                if kind == 'construct_mutation':
                    row['observedAA']='V'; expected=(pos,aa,'A','A',pos,pos,'','V',[1.,2.,3.])
                if kind == 'chain_identity':
                    row['authChain']='X'; expected=(pos,aa,'A','X',pos,pos,'',aa,[1.,2.,3.])
                with self.subTest(position=pos,kind=kind):
                    result=map_residues(reference,[row])[0]
                    self.assertEqual(tuple(result[k] for k in row), expected)

    def test_mapping_rejects_duplicate_aliases_and_wrong_reference(self):
        row=dict(referencePosition=1,referenceAA='A',labelChain='A',authChain='X',labelSeq=1,authSeq=1,insertionCode='',observedAA='A',ca=[0,0,0])
        with self.assertRaises(ValueError): map_residues('A',[row,row])
        with self.assertRaises(ValueError): map_residues('G',[row])

    def test_known_rigid_transform(self):
        import numpy as np
        left=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]]
        right=[[2,3,4],[2,4,4],[1,3,4],[2,3,5]]
        fit=superpose(left,right)
        self.assertLess(fit['rmsd'],.001)
        self.assertTrue(np.allclose(fit['rotation'],[[0,1,0],[-1,0,0],[0,0,1]]))
        self.assertTrue(np.allclose(fit['translation'],[-3,2,-4]))
        self.assertAlmostEqual(np.linalg.det(fit['rotation']),1)

    def test_rejects_underdetermined_fits(self):
        for xyz in [[[0,0,0]], [[0,0,0],[1,0,0]], [[0,0,0],[1,0,0],[2,0,0]]]:
            with self.assertRaises(ValueError): superpose(xyz,xyz)

    def test_reflections_do_not_count_as_rigid_rotations(self):
        import numpy as np
        left=[[0,0,0],[1,0,0],[0,2,0],[0,0,3]]
        right=[[0,0,0],[-1,0,0],[0,2,0],[0,0,3]]
        fit=superpose(left,right)
        self.assertGreater(fit['rmsd'],.1)
        self.assertAlmostEqual(np.linalg.det(fit['rotation']),1)

    def test_blosum_known_entries_and_combinations(self):
        scores=score_variants(['A1V','G2D','A1V:G2D'],'AG')
        self.assertEqual([r['score'] for r in scores['scores']],[0,-1,-1])
        with self.assertRaises(ValueError): score_variants(['A1V','A1V'],'AG')


class FrozenCaseTests(unittest.TestCase):
    def test_curated_case_is_reproducible_and_paired(self):
        from scientific.case_data import read_json
        manifest=read_json('manifest.json')
        self.assertEqual(len(manifest['reference']['sequence']),188)
        obs=read_json('observations.json')
        self.assertGreater(len(obs),26000)
        self.assertEqual(sum(r['abundance'] is not None and r['binding'] is not None for r in obs),23072)
        self.assertEqual(len({r['variant'] for r in obs}),len(obs))

    def test_actual_cif_mapping_preserves_tag_offset_and_mutation(self):
        import scientific.case_data as cd
        self.assertTrue(hasattr(cd,'extract_cif_mapping'),'mmCIF mapping not implemented')
        reference=''.join((cd.CASE_DIR/'sources/P01116-2.fasta').read_text().splitlines()[1:])
        for pdb in ['5O2S','5O2T']:
            rows, meta=cd.extract_cif_mapping(cd.CASE_DIR/'sources'/f'{pdb}.cif',reference,'A')
            row=next(r for r in rows if r['referencePosition']==12)
            self.assertEqual((row['labelSeq'],row['authSeq'],row['referenceAA'],row['observedAA']),(15,12,'G','V'))
            self.assertEqual(meta['constructMutations'],['G12V'])
            self.assertEqual(meta['outsideConstruct'],list(range(167,189)))

    def test_missing_positions_are_excluded_and_coverage_uses_reference(self):
        from scientific.compare import compare_structures
        result=compare_structures('5O2S','5O2T',[10,11,12,13,188])
        self.assertEqual(result['positions'],[10,11,12,13])
        self.assertEqual(result['coverage'],4/188)
        self.assertEqual(result['count'],4)
        self.assertTrue(any('188' in x for x in result['exclusions']))

    def test_actual_pair_against_independent_gemmi_qcp(self):
        import gemmi
        import numpy as np
        from scientific.case_data import load_structure
        from scientific.compare import compare_structures
        fit=compare_structures('5O2S','5O2T')
        left={r['referencePosition']:r for r in load_structure('5O2S')[1]}
        right={r['referencePosition']:r for r in load_structure('5O2T')[1]}
        p=fit['positions']
        independent=gemmi.superpose_positions([gemmi.Position(*left[i]['ca']) for i in p],[gemmi.Position(*right[i]['ca']) for i in p])
        self.assertAlmostEqual(fit['rmsd'],independent.rmsd,places=8)
        self.assertTrue(np.allclose(fit['rotation'],independent.transform.mat.tolist(),atol=1e-8))
        self.assertTrue(np.allclose(fit['translation'],independent.transform.vec.tolist(),atol=1e-8))

    def test_worker_cli_rejects_path_injection_and_returns_json(self):
        import json, subprocess, sys
        for request,code in [({'type':'baseline','variants':['G12D']},0),({'type':'comparison','leftId':'../../tmp/x','rightId':'5O2T'},1),({'type':'baseline','variants':['G12D'],'url':'https://example.com'},1)]:
            p=subprocess.run([sys.executable,'-m','scientific.worker'],input=json.dumps(request),capture_output=True,text=True)
            self.assertEqual(p.returncode,code)
            output=json.loads(p.stdout)
            self.assertIsInstance(output,dict)
            if code:self.assertIn('error',output)

class EmptySelectionTests(unittest.TestCase):
    def test_empty_position_list_means_all_shared_residues(self):
        from scientific.worker import run
        result=run(dict(type='comparison',leftId='5O2S',rightId='5O2T',positions=[]))
        self.assertEqual(result['count'],164)
        self.assertAlmostEqual(result['rmsd'],1.5076231048929027)

class WildTypeControlTests(unittest.TestCase):
    def test_wild_type_control_has_empty_sum_zero(self):
        from scientific.worker import run
        result=run(dict(type='baseline',variants=['WT','G12D']))
        self.assertEqual(result['scores'],[{'variant':'WT','score':0.0},{'variant':'G12D','score':-1.0}])
