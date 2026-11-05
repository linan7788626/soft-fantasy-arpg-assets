"""Rounded orthographic enclosure geometry; all raster sources remain untouched."""
import math
CELL, STEP, HALF, HEIGHT, RADIUS = 64, 4, 20, 128, 12

def boundary_loops(mask):
    edges = {}
    for x, y in mask:
        for neighbor, a, b in [((x,y-1),(x,y),(x+1,y)),((x+1,y),(x+1,y),(x+1,y+1)),((x,y+1),(x+1,y+1),(x,y+1)),((x-1,y),(x,y+1),(x,y))]:
            if neighbor not in mask:
                edges[a] = b
    loops = []
    while edges:
        start = next(iter(edges)); p = start; points = []
        while True:
            points.append((p[0]*STEP,p[1]*STEP)); p = edges.pop(p)
            if p == start: break
        simple = []
        for i, p in enumerate(points):
            prev, nxt = points[i-1], points[(i+1)%len(points)]
            if (p[0]-prev[0])*(nxt[1]-p[1]) != (p[1]-prev[1])*(nxt[0]-p[0]): simple.append(p)
        rounded = []
        for i, p in enumerate(simple):
            prev, nxt = simple[i-1], simple[(i+1)%len(simple)]
            lp, ln = math.dist(prev,p), math.dist(nxt,p)
            radius = min(RADIUS, lp*.45, ln*.45)
            a = (p[0]+(prev[0]-p[0])*radius/lp,p[1]+(prev[1]-p[1])*radius/lp)
            b = (p[0]+(nxt[0]-p[0])*radius/ln,p[1]+(nxt[1]-p[1])*radius/ln)
            for j in range(7):
                t=j/6
                rounded.append([round((1-t)**2*a[0]+2*(1-t)*t*p[0]+t*t*b[0],4),round((1-t)**2*a[1]+2*(1-t)*t*p[1]+t*t*b[1],4)])
        loops.append(rounded)
    return loops

def make_walls(cap_size, face_size):
    x,y,w,h,r=6.5*CELL-40,HALF-104,80,104,12
    opening=[[x,y+h],[x,y+r]]
    for j in range(1,9):
        t=j/8;opening.append([(1-t)**2*x+2*(1-t)*t*x+t*t*(x+r),(1-t)**2*(y+r)+2*(1-t)*t*y+t*t*y])
    opening.append([x+w-r,y])
    for j in range(1,9):
        t=j/8;opening.append([(1-t)**2*(x+w-r)+2*(1-t)*t*(x+w)+t*t*(x+w),(1-t)**2*y+2*(1-t)*t*y+t*t*(y+r)])
    opening.append([x+w,y+h])
    gate={'start':5,'end':8,'passage':6,'x':5*CELL,'y':-HALF-HEIGHT,'width':3*CELL,'height':HEIGHT+2*HALF,'baseline':HALF,'integrated':True,'render_mode':'carved-wall','closed_asset':'door_closed','open_asset':None,'opening':{'rect':[x,y,w,h],'contour':opening,'leaf_rect':[x+2,y+2,w-4,h-4]},'occlusion_rect':[5*CELL-HALF,-HALF-HEIGHT,3*CELL+2*HALF,HEIGHT+2*HALF]}
    result={'thickness':2*HALF,'height':HEIGHT,'corner_radius':RADIUS,'cap_asset':'wall_cap','face_asset':'wall_face','texture_period':256,'gate':gate,'puzzle_open_rows':[3,6],'projection':'rounded orthographic wall volume; shared continuous cap above the carved portal','layouts':{}}
    for layout in ['hall','elbow','puzzle']:
        def room(x,y): return 0<=x<12 and 0<=y<8 and (layout!='elbow' or x<6 or y<4)
        mask, edges={},[]
        def add_rect(x0,y0,x1,y1,fg=False):
            for yy in range(y0//STEP,y1//STEP):
                for xx in range(x0//STEP,x1//STEP): mask[xx,yy]=mask.get((xx,yy),False) or fg
        for y in range(8):
            for x in range(12):
                if not room(x,y): continue
                for dx,dy in [(0,-1),(0,1),(-1,0),(1,0)]:
                    if room(x+dx,y+dy): continue
                    if dy:
                        yy=(y+(dy==1))*CELL
                        add_rect(x*CELL,yy-HALF,(x+1)*CELL,yy+HALF,dy==1)
                        edges.append(((x*CELL,yy),((x+1)*CELL,yy),dy==1))
                    else:
                        xx=(x+(dx==1))*CELL
                        add_rect(xx-HALF,y*CELL,xx+HALF,(y+1)*CELL)
                        edges.append(((xx,y*CELL),(xx,(y+1)*CELL),False))
        if layout=='puzzle':
            for y0,y1 in [(0,3),(6,8)]: add_rect(8*CELL-HALF,y0*CELL,8*CELL+HALF,y1*CELL)
        vertices={}
        for a,b,fg in edges:
            for p in [a,b]: vertices.setdefault(p,[]).append((a[1]==b[1],fg))
        for (x,y),ds in vertices.items():
            if {d[0] for d in ds}=={True,False}: add_rect(x-HALF,y-HALF,x+HALF,y+HALF,any(d[1] for d in ds))
        contours=boundary_loops(mask)
        cap_contours=[[[x,y-HEIGHT] for x,y in loop] for loop in contours]
        # Rectangle union partitions only the foreground redraw. The complete
        # rounded cap is drawn behind objects first, so these splits never open seams.
        fg_rects=[]
        ys=sorted({y for x,y in mask})
        for y in ys:
            xs=sorted(x for x,yy in mask if yy==y and mask[x,yy])
            if not xs: continue
            start=previous=xs[0]
            for x in xs[1:]+[None]:
                if x is not None and x==previous+1: previous=x;continue
                xx,w=start*STEP,(previous+1-start)*STEP
                found=next((r for r in reversed(fg_rects) if r[0]==xx and r[2]==w and r[1]+r[3]==y*STEP-HEIGHT),None)
                if found: found[3]+=STEP
                else: fg_rects.append([xx,y*STEP-HEIGHT,w,STEP])
                start=previous=x
        faces=[];outlines=[]
        for loop in contours:
            line_runs=[]
            for i,a in enumerate(loop):
                b=loop[(i+1)%len(loop)];dx,dy=b[0]-a[0],b[1]-a[1]
                length=math.hypot(dx,dy)
                if length<.0001: continue
                mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2
                inside=(math.floor((mx-dy/length*2)/STEP),math.floor((my+dx/length*2)/STEP))
                fg=bool(mask.get(inside,False))
                aa=[a[0],a[1]-HEIGHT];bb=[b[0],b[1]-HEIGHT]
                if line_runs and line_runs[-1]['foreground']==fg and line_runs[-1]['points'][-1]==aa: line_runs[-1]['points'].append(bb)
                else: line_runs.append({'points':[aa,bb],'foreground':fg})
                if dx>=-.0001: continue  # Only south-facing surfaces are visible.
                left,right=b,a
                x=left[0]
                while x<right[0]-.0001:
                    end=min(right[0],(math.floor(x/256)+1)*256)
                    if end-x<.0001: break
                    y0=left[1]+(right[1]-left[1])*(x-left[0])/(right[0]-left[0])
                    y1=left[1]+(right[1]-left[1])*(end-left[0])/(right[0]-left[0])
                    # Keep stone courses at their original aspect as walls grow.
                    for offset in range(0,HEIGHT,64):
                        band=min(64,HEIGHT-offset)
                        faces.append({'asset':'wall_face','src':[x%256/256*face_size[0],0,(end-x)/256*face_size[0],face_size[1]*band/64],'transform':[end-x,y1-y0,0,band,x,y0-HEIGHT+offset],'foreground':fg})
                    x=end
            outlines.extend(line_runs)
        area=lambda p:sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))/2
        result['layouts'][layout]={'cap_contours':cap_contours,'cap_outer_contours':[p for p in cap_contours if area(p)>0],'cap_hole_contours':[p for p in cap_contours if area(p)<0],'foreground_rects':fg_rects,'faces':faces,'outlines':outlines,'bounds':[-HALF,-HALF-HEIGHT,12*CELL+2*HALF,8*CELL+2*HALF+HEIGHT]}
    return result
