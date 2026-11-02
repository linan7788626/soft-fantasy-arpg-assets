extends Node2D

const CELL = 64.0
const ORIGIN = Vector2(100, 196)
var manifest: Dictionary
var textures: Dictionary = {}
var modules: Dictionary = {}
var hero: AnimatedSprite2D
var crate_sprite: Sprite2D
var plate_sprite: Sprite2D
var gate_sprite: Sprite2D
var caption: Label
var player = Vector2(2.5, 5.5)
var crate = Vector2i(5, 4)
var plate = Vector2i(7, 4)
var direction = "east"
var pushing = false
var door = false
var pressed = false

func _ready():
	manifest = JSON.parse_string(FileAccess.get_file_as_string("res://Art/manifest.json"))
	for entry in manifest.assets:
		textures[entry.id] = load("res://Art/" + entry.file)
		modules[entry.id] = entry
	hero = AnimatedSprite2D.new()
	hero.sprite_frames = SpriteFrames.new()
	hero.sprite_frames.remove_animation("default")
	hero.centered = false
	for d in manifest.walks:
		var walk: Dictionary = manifest.walks[d]
		textures["walk_" + d] = load("res://Art/" + walk.file)
		for state in ["walk", "idle"]:
			var name = state + "_" + d
			hero.sprite_frames.add_animation(name)
			hero.sprite_frames.set_animation_speed(name, walk.fps)
			hero.sprite_frames.set_animation_loop(name, true)
			var indices = range(walk.frames.size()) if state == "walk" else [int(walk.idle_frame)]
			for i in indices:
				var atlas = AtlasTexture.new()
				atlas.atlas = textures["walk_" + d]
				atlas.region = rect(walk.frames[i].rect)
				hero.sprite_frames.add_frame(name, atlas)
	gate_sprite = module_sprite("door_closed", ORIGIN + Vector2(5 * CELL, -180), Vector2(192, 192))
	plate_sprite = module_sprite("plate", ORIGIN + Vector2(plate) * CELL, Vector2(64, 44.8))
	crate_sprite = module_sprite("crate", ORIGIN + Vector2(crate) * CELL + Vector2(0, -8), Vector2(64, 72))
	crate_sprite.z_index = 1
	add_child(hero)
	hero.frame_changed.connect(align_hero)
	hero.animation_changed.connect(align_hero)
	var order = ["east", "south", "west", "north"]
	for i in range(order.size()):
		var d = order[i]
		var f = manifest.walks[d].frames[1]
		var preview = Sprite2D.new()
		preview.texture = hero.sprite_frames.get_frame_texture("idle_" + d, 0)
		preview.centered = false
		preview.offset = -Vector2(f.rect[2] * f.pivot[0], f.rect[3] * f.pivot[1])
		preview.scale = Vector2.ONE * (88.0 / f.rect[3])
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
	align_hero()
	if "--verify" in OS.get_cmdline_user_args():
		set_process(false)
		run_validation.call_deferred()

func rect(r):
	return Rect2(r[0], r[1], r[2], r[3])

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

func align_hero():
	if hero.animation.is_empty():
		return
	var frames: Array = manifest.walks[direction].frames
	var i = hero.frame if String(hero.animation).begins_with("walk_") else int(manifest.walks[direction].idle_frame)
	var f: Dictionary = frames[i]
	hero.offset = -Vector2(f.rect[2] * f.pivot[0], f.rect[3] * f.pivot[1])
	hero.scale = Vector2.ONE * (104.0 / f.rect[3])
	hero.position = ORIGIN + player * CELL
	if is_instance_valid(crate_sprite):
		hero.z_index = 0 if hero.position.y < crate_sprite.position.y + 72 else 2
		gate_sprite.z_index = 3 if player.y < 0 else 0

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

func blocked(p: Vector2) -> bool:
	var cell = Vector2i(floor(p.x), floor(p.y))
	if door and cell == Vector2i(6, -1):
		return false
	return cell.x < 0 or cell.x >= 12 or cell.y < 0 or cell.y >= 8 or cell == crate or (cell.y == 0 and cell.x in [5, 7])

func move_by(v: Vector2):
	var before = player
	if not blocked(player + Vector2(v.x, 0)):
		player.x += v.x
	if not blocked(player + Vector2(0, v.y)):
		player.y += v.y
	# Face the input while keeping the animation paused at an obstruction.
	if not v.is_zero_approx():
		set_motion(v)
	set_motion(player - before)

func _process(delta):
	if not pushing:
		var v = Vector2(float(Input.is_physical_key_pressed(KEY_RIGHT) or Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_LEFT) or Input.is_physical_key_pressed(KEY_A)), float(Input.is_physical_key_pressed(KEY_DOWN) or Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_UP) or Input.is_physical_key_pressed(KEY_W)))
		move_by(v.normalized() * delta * 2.2)
	align_hero()
	caption.text = "WASD / arrows: move | E: push | %s | plate: %s | gate: %s" % [direction, pressed, door]

func _unhandled_key_input(event):
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_E:
		push_crate()

func push_crate() -> bool:
	if pushing or player.distance_to(Vector2(crate) + Vector2.ONE * 0.5) > 1.8:
		return false
	var v = Vector2(crate) + Vector2.ONE * 0.5 - player
	if v.length() < 0.2:
		return false
	var step = Vector2i(sign(v.x), 0) if abs(v.x) >= abs(v.y) else Vector2i(0, sign(v.y))
	var target = crate + step
	if target.x < 0 or target.x >= 12 or target.y < 0 or target.y >= 8 or (target.y == 0 and target.x in [5, 7]):
		return false
	pushing = true
	set_motion(Vector2(step))
	var from = player
	crate = target
	pressed = false
	set_module(plate_sprite, "plate")
	var tween = create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT).set_parallel(true)
	tween.tween_property(crate_sprite, "position", ORIGIN + Vector2(crate) * CELL + Vector2(0, -8), 0.26)
	tween.tween_method(func(k): player = from + Vector2(step) * k; align_hero(), 0.0, 1.0, 0.26)
	tween.finished.connect(func(): pushing = false; update_mechanism(); set_motion(Vector2.ZERO))
	return true

func update_mechanism():
	pressed = crate == plate
	door = pressed
	set_module(plate_sprite, "plate_pressed" if pressed else "plate")
	set_module(gate_sprite, "door_open" if door else "door_closed")

func _draw():
	if manifest.is_empty():
		return
	var texture: Texture2D = textures.floor
	var tile = texture.get_size() / 6.0
	for y in range(8):
		for x in range(12):
			draw_texture_rect_region(texture, Rect2(ORIGIN + Vector2(x, y) * CELL, Vector2.ONE * CELL), Rect2(Vector2(x % 6, y % 6) * tile, tile))
	for x in range(12):
		for y in [0, 8]:
			if y == 0 and x in [5, 6, 7]:
				continue
			draw_texture_rect_region(textures.wall, Rect2(ORIGIN + Vector2(x * CELL, y * CELL - 30), Vector2(CELL, 42)), rect(modules.wall.rect))
	for y in range(8):
		for x in [0, 12]:
			draw_texture_rect_region(textures.sidewall, Rect2(ORIGIN + Vector2(x * CELL - 16, y * CELL - 30), Vector2(32, CELL)), rect(modules.sidewall.rect))
	for p in [Vector2(0, 0), Vector2(12, 0), Vector2(0, 8), Vector2(12, 8)]:
		draw_texture_rect_region(textures.pillar, Rect2(ORIGIN + p * CELL - Vector2(20, 42), Vector2(40, 54)), rect(modules.pillar.rect))

func run_validation():
	var checks: Array = []
	for entry in manifest.assets:
		assert(textures[entry.id].get_size() == Vector2(entry.native_size[0], entry.native_size[1]))
	checks.append("Godot imported all native module textures at original dimensions")
	for d in manifest.walks:
		assert(hero.sprite_frames.get_frame_count("walk_" + d) == 6)
		for i in range(6):
			var f = manifest.walks[d].frames[i]
			var atlas: AtlasTexture = hero.sprite_frames.get_frame_texture("walk_" + d, i)
			assert(atlas.region == rect(f.rect))
			assert(atlas.region.end.x <= atlas.atlas.get_width() and atlas.region.end.y <= atlas.atlas.get_height())
		set_motion({"east":Vector2.RIGHT,"west":Vector2.LEFT,"north":Vector2.UP,"south":Vector2.DOWN}[d])
		var before = hero.frame
		await get_tree().create_timer(0.16).timeout
		assert(hero.frame != before and hero.is_playing())
		set_motion(Vector2.ZERO)
		assert(hero.animation == "idle_" + d and not hero.is_playing())
		var foot = hero.position + (hero.offset + Vector2(manifest.walks[d].frames[1].rect[2] * manifest.walks[d].frames[1].pivot[0], manifest.walks[d].frames[1].rect[3] * manifest.walks[d].frames[1].pivot[1])) * hero.scale
		assert(foot.distance_to(ORIGIN + player * CELL) < 0.01)
	checks.append("24 AtlasTexture frames, four timed walk animations, four paused idle states and foot anchors")
	player = Vector2(0.01, 2.5)
	move_by(Vector2(-0.1, 0))
	assert(is_equal_approx(player.x, 0.01) and not hero.is_playing())
	checks.append("Blocked movement stays idle")
	player = Vector2(4.5, 4.5)
	assert(push_crate())
	assert(not push_crate())
	await get_tree().create_timer(0.10).timeout
	assert(crate_sprite.position.x > ORIGIN.x + 5 * CELL and crate_sprite.position.x < ORIGIN.x + 6 * CELL)
	await get_tree().create_timer(0.23).timeout
	assert(not pushing and not pressed)
	assert(push_crate())
	await get_tree().create_timer(0.33).timeout
	assert(pressed and door and crate == plate)
	assert(gate_sprite.texture.atlas == textures.door_open)
	assert(plate_sprite.texture.atlas == textures.plate_pressed)
	assert(push_crate())
	await get_tree().create_timer(0.33).timeout
	assert(not pressed and not door and plate_sprite.texture.atlas == textures.plate)
	checks.append("Tweened push, repeat rejection, plate activation/release and gate texture transitions")
	caption.text = "Godot native import trial — four directions / paused idle / plate reset verified"
	await get_tree().process_frame
	var renderer = DisplayServer.get_name()
	if renderer != "headless":
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://Validation/engine.png")
	var report = {"status":"passed", "engine":Engine.get_version_info().string, "display_server":renderer, "checks":checks, "limits":["Small import harness; not a complete game integration", "Unity Editor not installed or validated", "Hand ownership and motion aesthetics require visual review"]}
	FileAccess.open("res://Validation/report.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t") + "\n")
	print(JSON.stringify(report))
	get_tree().quit()
