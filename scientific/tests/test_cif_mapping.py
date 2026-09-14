"""Literal software mapping fixtures; no claim of external expert review."""
import tempfile
import unittest
from pathlib import Path
import gemmi
from scientific.case_data import extract_cif_mapping


def cif_fixture(kind, corrupt_author=False):
    block=gemmi.cif.Block('fixture')
    block.set_pair('_struct.title',"'Software fixture'")
    block.set_pair('_exptl.method',"'X-RAY DIFFRACTION'")
    block.set_pair('_refine.ls_d_res_high','2.0')
    offset=3 if kind=='tag_offset' else 0
    author_offset=100 if kind=='author_offset' else 0
    author='X' if kind=='chain_identity' else 'A'
    insertion='B' if kind=='insertion' else '.'
    loop=block.init_loop('_struct_ref_seq.',['pdbx_strand_id','pdbx_db_accession','seq_align_beg','seq_align_end','db_align_beg','db_align_end'])
    loop.add_row([author,'P01116',str(1+offset),str(5+offset),'1','5'])
    scheme=block.init_loop('_pdbx_poly_seq_scheme.',['asym_id','entity_id','seq_id','mon_id','pdb_strand_id','pdb_seq_num','pdb_ins_code'])
    atom=block.init_loop('_atom_site.',['label_asym_id','label_entity_id','label_atom_id','label_seq_id','label_alt_id','label_comp_id','auth_asym_id','auth_seq_id','pdbx_PDB_ins_code','occupancy','Cartn_x','Cartn_y','Cartn_z','pdbx_PDB_model_num'])
    for pos,three in [(1,'ALA'),(2,'CYS'),(3,'ASP'),(4,'GLU'),(5,'PHE')]:
        label=str(pos+offset);auth=str(pos+author_offset)
        scheme.add_row(['A','1',label,three,author,auth,insertion])
        if kind!='unresolved':
            atom.add_row(['A','1','CA',label,'.',three,author,'999' if corrupt_author else auth,insertion,'1',str(pos),'2','3','1'])
    return block.as_string()


class CifMappingTests(unittest.TestCase):
    def test_thirty_cif_mapping_cases_six_edge_classes(self):
        # Explicit expected reference/label/author/CA identities; fixture writer
        # does not calculate the expectations.
        fixtures={
          'standard':[(1,'A',1,1,'A','',True),(2,'C',2,2,'A','',True),(3,'D',3,3,'A','',True),(4,'E',4,4,'A','',True),(5,'F',5,5,'A','',True)],
          'tag_offset':[(1,'A',4,1,'A','',True),(2,'C',5,2,'A','',True),(3,'D',6,3,'A','',True),(4,'E',7,4,'A','',True),(5,'F',8,5,'A','',True)],
          'author_offset':[(1,'A',1,101,'A','',True),(2,'C',2,102,'A','',True),(3,'D',3,103,'A','',True),(4,'E',4,104,'A','',True),(5,'F',5,105,'A','',True)],
          'insertion':[(1,'A',1,1,'A','B',True),(2,'C',2,2,'A','B',True),(3,'D',3,3,'A','B',True),(4,'E',4,4,'A','B',True),(5,'F',5,5,'A','B',True)],
          'unresolved':[(1,'A',1,1,'A','',False),(2,'C',2,2,'A','',False),(3,'D',3,3,'A','',False),(4,'E',4,4,'A','',False),(5,'F',5,5,'A','',False)],
          'chain_identity':[(1,'A',1,1,'X','',True),(2,'C',2,2,'X','',True),(3,'D',3,3,'X','',True),(4,'E',4,4,'X','',True),(5,'F',5,5,'X','',True)],
        }
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'fixture.cif'
            for kind,expectations in fixtures.items():
                path.write_text(cif_fixture(kind))
                rows,_=extract_cif_mapping(path,'ACDEF','A')
                for row,expected in zip(rows,expectations):
                    with self.subTest(kind=kind,position=expected[0]):
                        self.assertEqual((row['referencePosition'],row['referenceAA'],row['labelSeq'],row['authSeq'],row['authChain'],row['insertionCode'],row['ca'] is not None),expected)
                self.assertEqual(len(rows),5)

    def test_conflicting_atom_and_scheme_author_identity_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'fixture.cif';path.write_text(cif_fixture('standard',corrupt_author=True))
            with self.assertRaises(ValueError):extract_cif_mapping(path,'ACDEF','A')
