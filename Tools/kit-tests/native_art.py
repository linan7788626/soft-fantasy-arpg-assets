"""Read-only acceptance checks: no image processing outputs are written."""
from pathlib import Path
from PIL import Image
import numpy as np
import hashlib, json

root = Path(__file__).resolve().parents[2]
kit = root / 'Assets/NLI_Prototype_Kit'
manifest = json.loads((kit / 'Documentation/manifest.json').read_text())
for record_file in ['generation-records.json', 'round2-generation.json', 'round3-generation.json', 'round4-generation.json', 'round5-generation.json', 'quest-art.json', 'combat-art.json', 'directional-combat-art.json']:
    for record in json.loads((kit / 'Documentation' / record_file).read_text())['records']:
        assert hashlib.sha256((kit / record['delivered_file']).read_bytes()).hexdigest() == record['sha256'], record['delivered_file']
records = []
for entry in manifest['assets'] + list(manifest['walks'].values()) + list(manifest['idles'].values()) + list(manifest['pushes'].values()):
    path = kit / entry['file']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256'], path
    im = Image.open(path)
    assert list(im.size) == entry['native_size']
    record = {'file': entry['file'], 'native_size': list(im.size), 'sha256': entry['sha256']}
    if im.mode == 'RGBA':
        a = np.array(im.getchannel('A'))
        assert a.max() == 255 and a.min() == 0, path
        edge_max = max(int(edge.max()) for edge in (a[0], a[-1], a[:, 0], a[:, -1]))
        # Preserve native antialiasing: up to 2/255 at a canvas edge is invisible,
        # whereas a solid/visible contour at an edge fails acceptance.
        assert edge_max <= 2, f'Visible contour touches canvas edge: {path}'
        record['canvas_edge_max_alpha'] = edge_max
        record['near_opaque_fraction_of_nonzero_alpha'] = float((a >= 250).sum() / (a > 0).sum())
        record['core_median_alpha'] = float(np.median(a[a > 128]))
    if 'frames' in entry:
        rects = []
        for f in entry['frames']:
            x, y, w, h = f['rect']
            assert x >= 0 and y >= 0 and x + w <= im.width and y + h <= im.height
            assert 0 <= f['pivot'][0] <= 1 and 0 <= f['pivot'][1] <= 1
            assert abs(y + h * f['pivot'][1] - f['foot_y']) < 0.001
            rects.append((x, x + w))
        assert all(left[1] <= right[0] for left, right in zip(rects, rects[1:])), path
        record['frames'] = len(rects)
        record['raw_foot_y_range'] = [min(f['foot_y'] for f in entry['frames']), max(f['foot_y'] for f in entry['frames'])]
        record['foot_anchor_error_px'] = 0
    records.append(record)
pose_assets = {entry['id']: entry for entry in manifest['assets']}
combat_regions = set()
for direction, actions in manifest['combat']['hero_actions'].items():
    assert len(actions['attack']) == 3 and len(actions['hurt']) == 2
    for pose in actions['attack'] + actions['hurt']:
        x, y, w, h = pose['rect']
        iw, ih = pose_assets[pose['id']]['native_size']
        assert 0 <= x < x+w <= iw and 0 <= y < y+h <= ih
        assert pose['scale'] > 0 and all(0 <= p <= 1 for p in pose['pivot'])
        region = (pose['id'], x, y, w, h)
        assert region not in combat_regions, (direction, region)
        combat_regions.add(region)
        if 'foot_px' in pose:
            fx, fy = pose['foot_px']
            assert abs(x + w * pose['pivot'][0] - fx) < .001
            assert abs(y + h * pose['pivot'][1] - fy) < .001
assert len(combat_regions) == 20
south_impact = manifest['combat']['hero_actions']['south']['attack'][1]
assert south_impact['rect'][1] + south_impact['rect'][3] - south_impact['foot_px'][1] > 35
out = root / 'Prototypes/DungeonWalk/Validation/native-art-report.json'
out.write_text(json.dumps({'status': 'passed', 'pixel_postprocessing': 'none', 'assets': records,
    'unique_active_images': len({r['file'] for r in records}),
    'unique_directional_combat_regions': len(combat_regions),
    'limits': ['Alpha bounds and metadata checks do not establish hand ownership or natural gait. See visual acceptance notes.']}, indent=2) + '\n')
print(f'{len({r["file"] for r in records})} native images, {len(records)} module/clip entries and {len(combat_regions)} combat regions verified without changing PNG bytes')
