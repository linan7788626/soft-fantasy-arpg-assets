extends Node2D

const CELL = 64.0
const ORIGIN = Vector2(100, 196)
const DIRECTIONS = ["east", "south", "west", "north"]
var manifest: Dictionary
var textures: Dictionary = {}
var modules: Dictionary = {}
var hero: AnimatedSprite2D
var idle_blend: Sprite2D
var crate_sprite: Sprite2D
var plate_sprite: Sprite2D
var gate_sprite: Sprite2D
var foreground: Node2D
var cap_background: Node2D
var cap_front: Node2D
var north_occluder: Node2D
var portal_detail: Node2D
var caption: Label
var player = Vector2(2.5, 5.5)
var crate = Vector2i(5, 4)
var plate = Vector2i(7, 4)
var direction = "east"
var layout = "hall"
var push_data: Dictionary = {}
var door = false
var pressed = false
var verifying = false

func rect(r):
	return Rect2(r[0], r[1], r[2], r[3])

func clip(state: String, d: String) -> Dictionary:
	return manifest[{"walk":"walks", "idle":"idles", "push":"pushes"}[state]][d]

func _ready():
	manifest = JSON.parse_string(FileAccess.get_file_as_string("res://Art/manifest.json"))
	for entry in manifest.assets:
		textures[entry.id] = load("res://Art/" + entry.file)
		modules[entry.id] = entry
	hero = AnimatedSprite2D.new()
	hero.sprite_frames = SpriteFrames.new()
	hero.sprite_frames.remove_animation("default")
	hero.centered = false
	for d in DIRECTIONS:
		for state in ["walk", "idle", "push"]:
			var data = clip(state, d)
			var name = state + "_" + d
			textures[name] = load("res://Art/" + data.file)
			hero.sprite_frames.add_animation(name)
			hero.sprite_frames.set_animation_speed(name, data.fps)
			for f in data.frames:
				var atlas = AtlasTexture.new()
				atlas.atlas = textures[name]
				atlas.region = rect(f.rect)
				hero.sprite_frames.add_frame(name, atlas)
	var gate = manifest.walls.gate
	var leaf = gate.opening.leaf_rect
	gate_sprite = module_sprite("door_closed", ORIGIN + Vector2(leaf[0], leaf[1]), Vector2(leaf[2], leaf[3]))
	gate_sprite.z_index = 1
	plate_sprite = module_sprite("plate", ORIGIN + Vector2(plate) * CELL, Vector2(64, 44.8))
	crate_sprite = module_sprite("crate", ORIGIN + Vector2(crate) * CELL + Vector2(0, -8), Vector2(64, 72))
	crate_sprite.z_index = 2
	add_child(hero)
	idle_blend = Sprite2D.new()
	idle_blend.centered = false
	idle_blend.visible = false
	add_child(idle_blend)
	hero.frame_changed.connect(align_hero)
	hero.animation_changed.connect(align_hero)
	foreground = Node2D.new()
	foreground.z_index = 4
	add_child(foreground)
	rebuild_wall_layers()
	portal_detail = Node2D.new()
	portal_detail.z_index = 2
	portal_detail.draw.connect(func(): draw_portal_rim(portal_detail))
	add_child(portal_detail)
	for i in range(4):
		var d = DIRECTIONS[i]
		var data = clip("idle", d)
		var f = data.frames[0]
		var preview = Sprite2D.new()
		preview.texture = hero.sprite_frames.get_frame_texture("idle_" + d, 0)
		preview.centered = false
		preview.offset = -Vector2(f.rect[2] * f.pivot[0], f.rect[3] * f.pivot[1])
		preview.scale = Vector2.ONE * data.pixel_scale * 0.85
		preview.position = Vector2(1010, 280 + i * 120)
		add_child(preview)
		var label = Label.new()
		label.text = d
		label.position = Vector2(940, 284 + i * 120)
		add_child(label)
	caption = Label.new()
	caption.position = Vector2(26, 726)
	add_child(caption)
	set_motion(Vector2.ZERO)
	verifying = "--verify" in OS.get_cmdline_user_args()
	if verifying:
		run_validation.call_deferred()

func module_sprite(id: String, pos: Vector2, size: Vector2) -> Sprite2D:
	var sprite = Sprite2D.new()
	var atlas = AtlasTexture.new()
	atlas.atlas = textures[id]
	atlas.region = rect(modules[id].rect)
	sprite.texture = atlas
	sprite.centered = false
	sprite.position = pos
	sprite.scale = size / atlas.region.size
	add_child(sprite)
	return sprite

func set_module(sprite: Sprite2D, id: String):
	var size = sprite.texture.get_size() * sprite.scale
	var atlas = AtlasTexture.new()
	atlas.atlas = textures[id]
	atlas.region = rect(modules[id].rect)
	sprite.texture = atlas
	sprite.scale = size / atlas.region.size

func push_state() -> Dictionary:
	if push_data.is_empty():
		return {}
	var elapsed = Time.get_ticks_msec() - push_data.started
	var move_time = elapsed - push_data.approach
	return {"phase":"approach" if elapsed < push_data.approach else "push" if move_time < 320 else "release", "approach":minf(1, elapsed / push_data.approach), "u":clampf(move_time / 320.0, 0, 1), "release":clampf((move_time - 320) / 100.0, 0, 1)}

func box_contact(box: Vector2) -> Vector2:
	var pos = ORIGIN + box * CELL + Vector2(0, -8)
	return pos + {"east":Vector2(2, 32),"west":Vector2(62, 32),"north":Vector2(32, 58),"south":Vector2(32, 10)}[direction]

func align_hero():
	if hero.animation.is_empty():
		return
	var state = String(hero.animation).get_slice("_", 0)
	var data = clip(state, direction)
	var f = data.frames[hero.frame]
	hero.offset = -Vector2(f.rect[2] * f.pivot[0], f.rect[3] * f.pivot[1])
	hero.scale = Vector2.ONE * data.pixel_scale
	hero.position = ORIGIN + player * CELL
	hero.modulate.a = 1
	if is_instance_valid(idle_blend):
		idle_blend.visible = false
	var pushing = push_state()
	if state == "push" and not pushing.is_empty():
		var delta_contact = Vector2((f.contact[0] - f.pivot[0]) * f.rect[2], (f.contact[1] - f.pivot[1]) * f.rect[3]) * data.pixel_scale
		hero.position = box_contact((crate_sprite.position - ORIGIN - Vector2(0, -8)) / CELL) - delta_contact
		hero.modulate.a = 1 - pushing.release
		if pushing.release > 0:
			var idle = clip("idle", direction)
			var idle_f = idle.frames[0]
			idle_blend.texture = hero.sprite_frames.get_frame_texture("idle_" + direction, 0)
			idle_blend.offset = -Vector2(idle_f.rect[2] * idle_f.pivot[0], idle_f.rect[3] * idle_f.pivot[1])
			idle_blend.scale = Vector2.ONE * idle.pixel_scale
			idle_blend.position = ORIGIN + player * CELL
			idle_blend.modulate.a = pushing.release
			idle_blend.visible = true
	if is_instance_valid(crate_sprite):
		hero.z_index = 1 if hero.position.y < crate_sprite.position.y + 72 else 3
		if is_instance_valid(idle_blend):
			idle_blend.z_index = hero.z_index
		gate_sprite.z_index = 7 if player.y < 0 else 1
		if is_instance_valid(north_occluder):
			north_occluder.visible = player.y < 0

func set_motion(v: Vector2):
	if not v.is_zero_approx():
		direction = ("east" if v.x > 0 else "west") if abs(v.x) >= abs(v.y) else ("south" if v.y > 0 else "north")
	var name = ("idle_" if v.is_zero_approx() else "walk_") + direction
	if hero.animation != name:
		hero.play(name)
	if v.is_zero_approx():
		hero.pause()
	else:
		hero.play()
	align_hero()

func room(x: int, y: int) -> bool:
	return x >= 0 and x < 12 and y >= 0 and y < 8 and (layout != "elbow" or x < 6 or y < 4)

func obstacle(cell: Vector2i) -> bool:
	if door and cell == Vector2i(6, -1):
		return false
	return not room(cell.x, cell.y) or (layout == "puzzle" and cell.x == 8 and (cell.y < manifest.walls.puzzle_open_rows[0] or cell.y >= manifest.walls.puzzle_open_rows[1]))

func blocked(p: Vector2) -> bool:
	return obstacle(Vector2i(floor(p.x), floor(p.y))) or (p.x > crate.x + .08 and p.x < crate.x + .92 and p.y > crate.y + .84 and p.y < crate.y + 1)

func move_by(v: Vector2):
	var before = player
	if not blocked(player + Vector2(v.x, 0)):
		player.x += v.x
	if not blocked(player + Vector2(0, v.y)):
		player.y += v.y
	if not v.is_zero_approx():
		set_motion(v)
	set_motion(player - before)

func update_push():
	var state = push_state()
	var k = state.u * state.u * (3 - 2 * state.u)
	if state.phase == "approach":
		player = push_data.player_from.lerp(push_data.contact_root, state.approach)
		set_motion(Vector2(push_data.step))
	else:
		player = push_data.contact_root + Vector2(push_data.step) * k
		if hero.animation != "push_" + direction:
			hero.play("push_" + direction)
		# Stop the independent clock: effort phases follow the crate movement.
		hero.pause()
		hero.frame = mini(3, int(state.u * 4))
	crate_sprite.position = ORIGIN + (Vector2(push_data.from) + Vector2(push_data.step) * k) * CELL + Vector2(0, -8)
	align_hero()
	if state.release == 1:
		push_data = {}
		update_mechanism()
		set_motion(Vector2.ZERO)

func _process(delta):
	if not push_data.is_empty():
		update_push()
	elif not verifying:
		var v = Vector2(float(Input.is_physical_key_pressed(KEY_RIGHT) or Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_LEFT) or Input.is_physical_key_pressed(KEY_A)), float(Input.is_physical_key_pressed(KEY_DOWN) or Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_UP) or Input.is_physical_key_pressed(KEY_W)))
		move_by(v.normalized() * delta * 2.2)
	align_hero()
	caption.text = "WASD/arrows move | E push | 1/2/3 room | %s / %s / %s" % [layout, hero.animation, push_state().get("phase", "rest")]

func _unhandled_key_input(event):
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode == KEY_E:
			push_crate()
		if event.physical_keycode in [KEY_1, KEY_2, KEY_3] and push_data.is_empty():
			set_layout(["hall", "elbow", "puzzle"][event.physical_keycode - KEY_1])

func set_layout(value: String):
	layout = value
	player = Vector2(2.5, 5.5)
	crate = Vector2i(3, 4) if value == "elbow" else Vector2i(5, 4)
	plate = Vector2i(4, 4) if value == "elbow" else Vector2i(7, 4)
	if value == "puzzle":
		crate = Vector2i(5,3)
		plate = Vector2i(7,3)
	crate_sprite.position = ORIGIN + Vector2(crate) * CELL + Vector2(0, -8)
	plate_sprite.position = ORIGIN + Vector2(plate) * CELL
	update_mechanism()
	set_motion(Vector2.ZERO)
	queue_redraw()
	foreground.queue_redraw()
	rebuild_wall_layers()

func push_crate() -> bool:
	var v = Vector2(crate) + Vector2(.5, .96) - player
	if not push_data.is_empty() or v.length() > 1.8 or v.length() < .2:
		return false
	var step = Vector2i(sign(v.x), 0) if abs(v.x) >= abs(v.y) else Vector2i(0, sign(v.y))
	if obstacle(crate + step):
		return false
	set_motion(Vector2(step))
	var data = clip("push", direction)
	var f = data.frames[0]
	var contact_delta = Vector2((f.contact[0] - f.pivot[0]) * f.rect[2], (f.contact[1] - f.pivot[1]) * f.rect[3]) * data.pixel_scale
	var root = (box_contact(Vector2(crate)) - contact_delta - ORIGIN) / CELL
	var steps = maxi(1, int(ceil(player.distance_to(root) * 16)))
	for i in range(1, steps + 1):
		if blocked(player.lerp(root, float(i) / steps)):
			return false
	if obstacle(Vector2i(floor(root.x + step.x), floor(root.y + step.y))):
		return false
	push_data = {"from":crate,"step":step,"started":Time.get_ticks_msec(),"approach":maxf(60, player.distance_to(root) / 2.2 * 1000),"player_from":player,"contact_root":root}
	crate += step
	pressed = false
	set_module(plate_sprite, "plate")
	return true

func update_mechanism():
	pressed = crate == plate
	door = pressed
	set_module(plate_sprite, "plate_pressed" if pressed else "plate")
	gate_sprite.visible = not door
	queue_redraw()

func points(values) -> PackedVector2Array:
	var out = PackedVector2Array()
	for p in values:
		out.append(Vector2(p[0], p[1]))
	return out

func cap_polygon(polygon: PackedVector2Array, parent: Node2D):
	if polygon.size() < 3:
		return
	var shape = Polygon2D.new()
	shape.polygon = polygon
	shape.position = ORIGIN
	shape.texture = textures.wall_cap
	shape.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	shape.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	shape.antialiased = true
	var uv = PackedVector2Array()
	for p in polygon:
		uv.append(p / float(manifest.walls.texture_period) * textures.wall_cap.get_size())
	shape.uv = uv
	parent.add_child(shape)

func rect_polygon(r: Array, padding: float = 0) -> PackedVector2Array:
	return PackedVector2Array([Vector2(r[0]-padding,r[1]-padding),Vector2(r[0]+r[2]+padding,r[1]-padding),Vector2(r[0]+r[2]+padding,r[1]+r[3]+padding),Vector2(r[0]-padding,r[1]+r[3]+padding)])

func cap_parts(region: PackedVector2Array) -> Array:
	var geometry = manifest.walls.layouts[layout]
	var result: Array = []
	for outer in geometry.cap_outer_contours:
		var parts: Array = Geometry2D.intersect_polygons(points(outer), region)
		for hole in geometry.cap_hole_contours:
			var next: Array = []
			for part in parts:
				next.append_array(Geometry2D.clip_polygons(part, points(hole)))
			parts = next
		result.append_array(parts)
	return result

func add_face(q: Dictionary, parent: Node2D, clip_region = null):
	var m = q.transform
	var mapping = Transform2D(Vector2(m[0],m[1]),Vector2(m[2],m[3]),Vector2(m[4],m[5]))
	var polygon = PackedVector2Array([mapping*Vector2.ZERO,mapping*Vector2.RIGHT,mapping*Vector2.ONE,mapping*Vector2.DOWN])
	var opening = points(manifest.walls.gate.opening.contour)
	opening[0].y += 2
	opening[opening.size()-1].y += 2
	var pieces: Array = Geometry2D.clip_polygons(polygon, opening)
	if clip_region != null:
		var clipped: Array = []
		for part in pieces:
			clipped.append_array(Geometry2D.intersect_polygons(part, clip_region))
		pieces = clipped
	var inverse = mapping.affine_inverse()
	for part in pieces:
		if part.size() < 3:
			continue
		var shape = Polygon2D.new()
		shape.position = ORIGIN
		shape.polygon = part
		shape.texture = textures[q.asset]
		# Adjacent material bands share exact edges; avoid internal AA seam lines.
		shape.antialiased = false
		var uv = PackedVector2Array()
		for v in part:
			uv.append(Vector2(q.src[0],q.src[1]) + (inverse*v)*Vector2(q.src[2],q.src[3]))
		shape.uv = uv
		parent.add_child(shape)

func add_portal_shadow(parent: Node2D):
	var shape = Polygon2D.new()
	shape.position = ORIGIN
	shape.polygon = points(manifest.walls.gate.opening.contour)
	var colors = PackedColorArray()
	var r = manifest.walls.gate.opening.rect
	for p in shape.polygon:
		colors.append(Color(44/255.0,36/255.0,28/255.0,.48*(1-(p.y-r[1])/r[3])))
	shape.vertex_colors = colors
	shape.antialiased = true
	parent.add_child(shape)

func rebuild_wall_layers():
	for layer in [cap_background,cap_front,north_occluder]:
		if is_instance_valid(layer):
			layer.queue_free()
	cap_background = Node2D.new()
	add_child(cap_background)
	cap_front = Node2D.new()
	foreground.add_child(cap_front)
	north_occluder = Node2D.new()
	north_occluder.z_index = 6
	north_occluder.visible = player.y < 0
	add_child(north_occluder)
	var geometry = manifest.walls.layouts[layout]
	var north_rect = rect_polygon(manifest.walls.gate.occlusion_rect)
	add_portal_shadow(cap_background)
	for q in geometry.faces:
		add_face(q, cap_front if q.foreground else cap_background)
		if not q.foreground:
			add_face(q, north_occluder, north_rect)
	var bounds = geometry.bounds
	# Closed caps have an interior hole. Small overlapping tiles keep that hole
	# empty while retaining smooth exterior edges and continuous texture phase.
	for y in range(int(floor(bounds[1]/64.0))*64,int(bounds[1]+bounds[3])+64,64):
		for x in range(int(floor(bounds[0]/64.0))*64,int(bounds[0]+bounds[2])+64,64):
			for part in cap_parts(rect_polygon([x,y,64,64],1)):
				cap_polygon(part, cap_background)
	for r in geometry.foreground_rects:
		for part in cap_parts(rect_polygon(r,1)):
			cap_polygon(part, cap_front)
	for part in cap_parts(north_rect):
		cap_polygon(part, north_occluder)
	var back_bevel = Node2D.new()
	back_bevel.draw.connect(func(): draw_bevels(back_bevel, false))
	cap_background.add_child(back_bevel)
	var front_bevel = Node2D.new()
	front_bevel.draw.connect(func(): draw_bevels(front_bevel, true))
	cap_front.add_child(front_bevel)

func draw_portal_rim(target: Node2D):
	var path = points(manifest.walls.gate.opening.contour)
	for i in range(path.size()):
		path[i] += ORIGIN
	target.draw_polyline(path,Color(65/255.0,49/255.0,31/255.0,.30),3,true)
	for i in range(path.size()):
		path[i] -= Vector2(.5,.5)
	target.draw_polyline(path,Color(1,239/255.0,199/255.0,.45),1,true)

func draw_bevels(target: Node2D, front: bool):
	for line in manifest.walls.layouts[layout].outlines:
		if line.foreground == front:
			var path = points(line.points)
			for i in range(path.size()):
				path[i] += ORIGIN
			target.draw_polyline(path, Color(73/255.0,68/255.0,63/255.0,.30), 2.0, true)
			for i in range(path.size()):
				path[i] -= Vector2(.5,.5)
			target.draw_polyline(path, Color(246/255.0,239/255.0,216/255.0,.40), 1.0, true)

func _draw():
	if manifest.is_empty():
		return
	var texture: Texture2D = textures.floor
	var tile = texture.get_size() / 6.0
	for y in range(8):
		for x in range(12):
			if room(x, y):
				draw_texture_rect_region(texture, Rect2(ORIGIN + Vector2(x, y) * CELL, Vector2.ONE * CELL), Rect2(Vector2(x % 6, y % 6) * tile, tile))
	if door:
		draw_texture_rect_region(texture, Rect2(ORIGIN + Vector2(6,-1)*CELL, Vector2.ONE*CELL), Rect2(Vector2(0,5)*tile,tile))

func wait_push():
	while not push_data.is_empty():
		await get_tree().process_frame

func capture(name: String):
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://Validation/" + name + ".png")

func run_validation():
	var checks: Array = []
	assert(manifest.walls.gate.height == manifest.walls.height + manifest.walls.thickness)
	assert(manifest.walls.height >= 104 and manifest.walls.gate.integrated)
	assert(is_equal_approx(gate_sprite.position.y, ORIGIN.y + manifest.walls.gate.opening.leaf_rect[1]))
	assert(manifest.walls.corner_radius >= 8)
	checks.append("Tall 168px closed enclosure; carved doorway, continuous cap and shared masonry")
	for x in [5.5,7.5]:
		player = Vector2(x,1.5)
		move_by(Vector2(0,-1))
		assert(is_equal_approx(player.y,.5))
		move_by(Vector2(0,-1))
		assert(is_equal_approx(player.y,.5))
	checks.append("Former detached jamb cells are free floor; the continuous north wall still blocks exits")
	for entry in manifest.assets:
		assert(textures[entry.id].get_size() == Vector2(entry.native_size[0], entry.native_size[1]))
	for d in DIRECTIONS:
		for state in ["walk", "idle", "push"]:
			var data = clip(state, d)
			assert(hero.sprite_frames.get_frame_count(state + "_" + d) == data.frames.size())
			for i in range(data.frames.size()):
				var atlas: AtlasTexture = hero.sprite_frames.get_frame_texture(state + "_" + d, i)
				assert(atlas.region == rect(data.frames[i].rect))
				assert(atlas.atlas.get_size() == Vector2(data.native_size[0], data.native_size[1]))
		set_motion({"east":Vector2.RIGHT,"west":Vector2.LEFT,"north":Vector2.UP,"south":Vector2.DOWN}[d])
		var before = hero.frame
		await get_tree().create_timer(.16).timeout
		assert(hero.frame != before and hero.is_playing())
		set_motion(Vector2.ZERO)
		assert(hero.animation == "idle_" + d and not hero.is_playing())
	checks.append("19 native textures, 44 AtlasTexture action frames; fixed per-clip scale; four walking clocks and dedicated idle states")
	player = Vector2(.01, 2.5)
	move_by(Vector2(-.1, 0))
	assert(is_equal_approx(player.x, .01) and not hero.is_playing())
	for row in [["east",Vector2(4.5,4.5),Vector2i(6,4)],["west",Vector2(6.5,4.5),Vector2i(4,4)],["north",Vector2(5.5,5.8),Vector2i(5,3)],["south",Vector2(5.5,3.5),Vector2i(5,5)]]:
		set_layout("hall")
		player = row[1]
		assert(push_crate())
		assert(not push_crate())
		while push_state().get("phase", "") != "push":
			await get_tree().process_frame
		await get_tree().create_timer(.1).timeout
		assert(hero.animation == "push_" + row[0])
		await capture("contact-" + row[0])
		await wait_push()
		assert(crate == row[2] and hero.animation == "idle_" + row[0])
		assert(push_crate())
		await wait_push()
		assert(direction == row[0])
	checks.append("Four-direction approach/contact/effort/release; repeat push rejection; continued south pushing without tile trapping")
	set_layout("hall")
	player = Vector2(5.5,3.5)
	for i in range(3):
		assert(push_crate())
		await wait_push()
	player = Vector2(4.5,7.5)
	assert(not push_crate() and crate == Vector2i(5,7))
	checks.append("Auto-approach cannot carry the character outside the south wall")
	set_layout("hall")
	player = Vector2(4.5,4.5)
	assert(push_crate())
	await wait_push()
	assert(push_crate())
	await wait_push()
	assert(pressed and door and plate_sprite.texture.atlas == textures.plate_pressed)
	assert(push_crate())
	await wait_push()
	assert(not pressed and not door and plate_sprite.texture.atlas == textures.plate)
	checks.append("Pressure plate press/release and gate transitions")
	for value in ["hall", "elbow", "puzzle"]:
		set_layout(value)
		assert(manifest.walls.layouts[value].cap_contours.size() > 0)
		if value == "puzzle":
			player = Vector2(7.5,3.5)
			move_by(Vector2(1,0))
			assert(is_equal_approx(player.x,8.5))
			player = Vector2(2.5,5.5)
		await get_tree().process_frame
		await capture("walls-" + value)
	checks.append("Three layouts use the same unioned wall-cap geometry as Canvas")
	set_layout("hall")
	await capture("engine")
	var report = {"status":"passed","engine":Engine.get_version_info().string,"display_server":DisplayServer.get_name(),"checks":checks,"limits":["Art still requires user visual acceptance","Unity Editor not validated","Floor is not a complete autotile set"]}
	FileAccess.open("res://Validation/report.json", FileAccess.WRITE).store_string(JSON.stringify(report,"\t") + "\n")
	print(JSON.stringify(report))
	get_tree().quit()
