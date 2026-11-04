"""One orthographic wall volume for both renderers; source PNG stays untouched.

Union boundary footprints before projecting them. This makes every inside/outside
corner share cap height and depth, rather than hiding incompatible ends with posts.
"""
CELL, STEP, HALF, HEIGHT = 64, 4, 12, 24
CAP = [220, 220, 1792, 54]
FACE = [220, 330, 1792, 168]

def make_walls():
    result = {'thickness': HALF * 2, 'height': HEIGHT,
              'projection': 'orthographic; height projects toward screen north',
              'material_asset': 'wall', 'layouts': {}}
    for layout in ['hall', 'elbow', 'puzzle']:
        def room(x, y):
            return 0 <= x < 12 and 0 <= y < 8 and (layout != 'elbow' or x < 6 or y < 4)
        mask, edges = {}, []
        def add_rect(x0, y0, x1, y1, foreground=False):
            for y in range(y0 // STEP, y1 // STEP):
                for x in range(x0 // STEP, x1 // STEP):
                    mask[x, y] = mask.get((x, y), False) or foreground
        for y in range(8):
            for x in range(12):
                if not room(x, y):
                    continue
                for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
                    if room(x + dx, y + dy):
                        continue
                    if dy == -1 and y == 0 and 5 <= x < 8:
                        continue  # The arch replaces this wall, in both gate states.
                    if dy:
                        yy = (y + (dy == 1)) * CELL
                        add_rect(x * CELL, yy - HALF, (x + 1) * CELL, yy + HALF, dy == 1)
                        edges.append(((x * CELL, yy), ((x + 1) * CELL, yy), dy == 1))
                    else:
                        xx = (x + (dx == 1)) * CELL
                        add_rect(xx - HALF, y * CELL, xx + HALF, (y + 1) * CELL)
                        edges.append(((xx, y * CELL), (xx, (y + 1) * CELL), False))
        if layout == 'puzzle':
            for y0, y1 in [(0, 4), (5, 8)]:
                add_rect(8 * CELL - HALF, y0 * CELL, 8 * CELL + HALF, y1 * CELL)
        # Orthogonal corners are part of the same solid, with no taller cover post.
        vertices = {}
        for start, end, fg in edges:
            for point in [start, end]:
                vertices.setdefault(point, []).append((start[1] == end[1], fg))
        for (x, y), directions in vertices.items():
            if {d[0] for d in directions} == {True, False}:
                add_rect(x - HALF, y - HALF, x + HALF, y + HALF, any(d[1] for d in directions))
        top_rows, face_rows = {}, {}
        for (x, y), fg in mask.items():
            top_rows.setdefault((y, fg), []).append(x)
            if (x, y + 1) not in mask:
                face_rows.setdefault((y + 1, fg), []).append(x)
        def runs(rows):
            for (y, fg), xs in sorted(rows.items()):
                xs = sorted(xs)
                start = previous = xs[0]
                for x in xs[1:] + [None]:
                    if x is not None and x == previous + 1:
                        previous = x
                        continue
                    yield start * STEP, y * STEP, (previous + 1 - start) * STEP, fg
                    start = previous = x
        top_rects = []
        for x, y, width, fg in runs(top_rows):
            # Merge adjacent rows with the same interval into long rectangles.
            found = next((r for r in reversed(top_rects) if r[0] == x and r[2] == width and r[4] == fg and r[1] + r[3] == y), None)
            if found:
                found[3] += STEP
            else:
                top_rects.append([x, y, width, STEP, fg])
        caps, faces = [], []
        def tile(rect, source, fg, target):
            x, y, w, h = rect
            # Explicit regions let Godot and Canvas sample the same native material.
            yy = y
            while yy < y + h:
                hh = min(24 - yy % 24, y + h - yy)
                xx = x
                while xx < x + w:
                    ww = min(256 - xx % 256, x + w - xx)
                    sx, sy, sw, sh = source
                    target.append({'src': [sx + xx % 256 / 256 * sw, sy + yy % 24 / 24 * sh,
                                           ww / 256 * sw, hh / 24 * sh],
                                   'dest': [xx, yy, ww, hh], 'foreground': fg})
                    xx += ww
                yy += hh
        for x, y, w, h, fg in top_rects:
            tile([x, y - HEIGHT, w, h], CAP, fg, caps)
        for x, y, w, fg in runs(face_rows):
            tile([x, y - HEIGHT, w, HEIGHT], FACE, fg, faces)
        result['layouts'][layout] = {'faces': faces, 'caps': caps,
                                    'bounds': [-HALF, -HALF - HEIGHT, 12 * CELL + 2 * HALF, 8 * CELL + 2 * HALF + HEIGHT]}
    return result
