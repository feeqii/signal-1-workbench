"""One bounded JSON request per process; no caller-controlled paths or URLs."""
import json
import sys
from scientific.baseline import score_variants
from scientific.case_data import read_json
from scientific.compare import compare_structures


def run(request):
    if not isinstance(request,dict):
        raise ValueError('Request must be an object')
    if request.get('type') == 'comparison':
        if set(request)-{'type','leftId','rightId','positions'}:
            raise ValueError('Unsupported comparison fields')
        return compare_structures(request.get('leftId'),request.get('rightId'),request.get('positions'))
    if request.get('type') == 'baseline':
        if set(request)-{'type','variants'}:
            raise ValueError('Unsupported baseline fields')
        return score_variants(request.get('variants'), read_json('manifest.json')['reference']['sequence'])
    raise ValueError('Unsupported request type')


def main():
    try:
        raw = sys.stdin.read(1_000_001)
        if len(raw)>1_000_000: raise ValueError('Request too large')
        result = run(json.loads(raw))
        print(json.dumps(result,allow_nan=False,separators=(',',':')))
    except (ValueError,TypeError,KeyError) as error:
        print(str(error),file=sys.stderr)
        print(json.dumps({'error':str(error)}))
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
