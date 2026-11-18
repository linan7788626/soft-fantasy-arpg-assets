extends Node2D

const CELL = 64.0
const ORIGIN = Vector2(100, 196)
const DIRECTIONS = ["east", "south", "west", "north"]
const WALL_FADE_SHADER = preload("res://wall_fade.gdshader")
const NORTH_EXIT_Y = -0.80
const ARENA_SPAWN = Vector2(2.5, 5.5)
const HALL_RETURN = Vector2(9.5, 4.6)
const FACING = {"east":Vector2.RIGHT, "south":Vector2.DOWN, "west":Vector2.LEFT, "north":Vector2.UP}
enum QuestStage { FIND_KEY, HAS_KEY, COMPLETE }
var manifest: Dictionary
var textures: Dictionary = {}
var modules: Dictionary = {}
var hero: AnimatedSprite2D
var idle_blend: Sprite2D
var crate_sprite: Sprite2D
var plate_sprite: Sprite2D
var gate_sprite: Sprite2D
var key_sprite: Sprite2D
var chest_sprite: Sprite2D
var arena_portal_sprite: Sprite2D
var slime_sprite: Sprite2D
var combat_pose: Sprite2D
var slime_cue: Node2D
var attack_cue: Node2D
var foreground: CanvasGroup
var cap_background: Node2D
var cap_front: Node2D
var north_occluder: CanvasGroup
var portal_detail: Node2D
var caption: Label
var objective: Label
var quest_stage = QuestStage.FIND_KEY
var hall_plate_activated = false
var player = Vector2(2.5, 5.5)
var crate = Vector2i(5, 4)
var plate = Vector2i(7, 4)
var direction = "east"
var layout = "hall"
var room_states: Dictionary = {}
var north_traversal_latched = false
var push_data: Dictionary = {}
var door = false
var pressed = false
var verifying = false
var hero_health = 0
var enemy_health = 0
var enemy_position = Vector2.ZERO
var enemy_windup = 0.0
var enemy_recovery = 0.0
var enemy_hurt = 0.0
var attack_time = 0.0
var attack_resolved = false
var attack_direction = "east"
var hurt_time = 0.0
var hurt_direction = "east"
var invulnerability = 0.0
var arena_completed = false

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
	gate_sprite.modulate = palette_color("door_closed")
	plate_sprite = module_sprite("plate", ORIGIN + Vector2(plate) * CELL, Vector2(64, 44.8))
	crate_sprite = module_sprite("crate", ORIGIN + Vector2(crate) * CELL + Vector2(0, -8), Vector2(64, 72))
	crate_sprite.z_index = 2
	key_sprite = Sprite2D.new()
	chest_sprite = Sprite2D.new()
	arena_portal_sprite = Sprite2D.new()
	slime_sprite = Sprite2D.new()
	combat_pose = Sprite2D.new()
	for sprite in [key_sprite, chest_sprite, arena_portal_sprite, slime_sprite, combat_pose]:
		sprite.centered = false
		add_child(sprite)
	arena_portal_sprite.z_index = 0
	slime_sprite.z_index = 2
	combat_pose.z_index = 3
	slime_cue = Node2D.new()
	slime_cue.draw.connect(draw_slime_cue)
	add_child(slime_cue)
	attack_cue = Node2D.new()
	attack_cue.z_index = 1
	attack_cue.draw.connect(draw_attack_cue)
	add_child(attack_cue)
	reset_combat()
	place_quest_sprite(key_sprite, "quest_key", "key_pos", 40)
	update_quest_props()
	add_child(hero)
	idle_blend = Sprite2D.new()
	idle_blend.centered = false
	idle_blend.visible = false
	add_child(idle_blend)
	hero.frame_changed.connect(align_hero)
	hero.animation_changed.connect(align_hero)
	foreground = wall_group(4)
	foreground.hide()
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
	objective = Label.new()
	objective.position = Vector2(26, 749)
	objective.modulate = Color("#ffe09a")
	add_child(objective)
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

func quest_position(field: String) -> Vector2:
	var position_cells: Array = manifest.quest[field]
	return Vector2(position_cells[0], position_cells[1])

func place_quest_sprite(sprite: Sprite2D, id: String, field: String, width: float):
	place_ground_sprite(sprite, id, quest_position(field), width)

func place_ground_sprite(sprite: Sprite2D, id: String, at: Vector2, width: float):
	var atlas: AtlasTexture = sprite.texture
	if atlas == null or atlas.atlas != textures[id]:
		atlas = AtlasTexture.new()
		atlas.atlas = textures[id]
		atlas.region = rect(modules[id].rect)
		sprite.texture = atlas
	var scale_factor = width / atlas.region.size.x
	var anchor = ORIGIN + at * CELL
	sprite.scale = Vector2.ONE * scale_factor
	sprite.position = anchor - Vector2(width / 2.0, atlas.region.size.y * scale_factor)

func update_quest_props():
	key_sprite.visible = layout == "elbow" and hall_plate_activated and quest_stage == QuestStage.FIND_KEY
	chest_sprite.visible = layout == "hall"
	var chest_asset = "chest_open" if quest_stage == QuestStage.COMPLETE else "chest_closed"
	if chest_sprite.texture == null or chest_sprite.texture.atlas != textures[chest_asset]:
		place_quest_sprite(chest_sprite, chest_asset, "chest_pos", 60)
	var in_arena = layout == "arena"
	arena_portal_sprite.visible = in_arena or (layout == "hall" and quest_stage == QuestStage.COMPLETE)
	if arena_portal_sprite.visible:
		place_ground_sprite(arena_portal_sprite, "arena_portal", combat_point("arena_portal" if in_arena else "hall_portal"), 86)

func collect_nearby_key():
	if key_sprite.visible and player.distance_to(quest_position("key_pos")) <= manifest.quest.pickup_radius:
		quest_stage = QuestStage.HAS_KEY
		update_quest_props()

func interact():
	if not push_data.is_empty():
		return
	if layout == "arena":
		if hero_health <= 0:
			retry_combat()
		elif player.distance_to(combat_point("arena_portal")) <= manifest.combat.portal_radius:
			load_room("hall", true)
			player = HALL_RETURN
			set_motion(Vector2.ZERO)
		return
	if layout == "hall" and quest_stage == QuestStage.COMPLETE and player.distance_to(combat_point("hall_portal")) <= manifest.combat.portal_radius:
		room_states["hall"] = {"crate": crate, "door": door}
		load_room("arena")
		return
	if chest_sprite.visible and player.distance_to(quest_position("chest_pos")) <= manifest.quest.open_radius:
		if quest_stage == QuestStage.HAS_KEY:
			quest_stage = QuestStage.COMPLETE
			update_quest_props()
		return
	push_crate()

func quest_objective() -> String:
	if layout == "arena":
		if arena_completed:
			return "Dungeon cleared! You reached the exit."
		if hero_health <= 0:
			return "You were knocked down. Press R or E to retry the fight."
		if door:
			return "Slime defeated. Walk through the north exit."
		return "Hero %d/%d  |  Slime %d/%d  |  Space: attack in the direction you face" % [hero_health, manifest.combat.hero_hp, enemy_health, manifest.combat.enemy_hp]
	if layout == "puzzle":
		return "Practice room: push the crate onto the pressure plate."
	if quest_stage == QuestStage.COMPLETE:
		if layout == "hall" and arena_portal_sprite.visible:
			return "Chest opened. Approach the blue portal and press E to enter the arena."
		return "Puzzle complete! Treasure chest opened."
	if quest_stage == QuestStage.HAS_KEY:
		return "Key collected. Return through the north door." if layout == "elbow" else "Approach the treasure chest and press E."
	if layout == "elbow":
		return "Walk up to the gold key." if key_sprite.visible else "Enter the gallery through the hall to start the treasure puzzle."
	if player.distance_to(quest_position("chest_pos")) <= manifest.quest.open_radius:
		return "The chest is locked. The key is in the gallery."
	return "Walk through the north door to find the key." if door else "Push the crate onto the plate to open the north door."

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
		var other_depth = ORIGIN.y + enemy_position.y * CELL if layout == "arena" else crate_sprite.position.y + 72
		hero.z_index = 1 if hero.position.y < other_depth else 3
		if is_instance_valid(idle_blend):
			idle_blend.z_index = hero.z_index
		chest_sprite.z_index = hero.z_index + 1 if player.y < quest_position("chest_pos").y else 0
		gate_sprite.z_index = 7 if player.y < 0 else 1
		if is_instance_valid(north_occluder):
			north_occluder.visible = player.y < 0
			update_wall_fade()

func update_wall_fade():
	var foot = player * CELL
	var center = to_global(ORIGIN + foot - Vector2(0, 50))
	var strength = 0.0
	for r in manifest.walls.layouts[layout].foreground_rects:
		var depth = foot.y - r[1]
		var distance_x = maxf(0.0, maxf(r[0] - foot.x, foot.x - r[0] - r[2]))
		var approach = smoothstep(-12.0, 16.0, depth)
		var lateral = 1.0 - smoothstep(0.0, 36.0, distance_x)
		var near_side = 1.0 - smoothstep(148.0, 176.0, depth)
		strength = maxf(strength, approach * lateral * near_side)
	foreground.material.set_shader_parameter("fade_center", center)
	foreground.material.set_shader_parameter("fade_strength", strength)
	north_occluder.material.set_shader_parameter("fade_center", center)

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
	return obstacle(Vector2i(floor(p.x), floor(p.y))) or (layout != "arena" and p.x > crate.x + .08 and p.x < crate.x + .92 and p.y > crate.y + .84 and p.y < crate.y + 1)

func move_by(v: Vector2):
	if v.y >= 0:
		north_traversal_latched = false
	elif north_traversal_latched:
		v.y = 0
	var before = player
	if not blocked(player + Vector2(v.x, 0)):
		player.x += v.x
	if not blocked(player + Vector2(0, v.y)):
		player.y += v.y
	var through_north_gate = player.y <= NORTH_EXIT_Y and floori(player.x) == int(manifest.walls.gate.passage)
	if layout == "arena" and through_north_gate and door:
		arena_completed = true
		player.y = -.78
	if v.y < 0 and door and through_north_gate and layout != "puzzle" and push_data.is_empty():
		if layout == "arena":
			set_motion(Vector2.ZERO)
			return
		room_states[layout] = {"crate": crate, "door": door}
		load_room("elbow" if layout == "hall" else "hall", true)
		north_traversal_latched = true
		return
	collect_nearby_key()
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
		collect_nearby_key()
		set_motion(Vector2.ZERO)

func _process(delta):
	if not push_data.is_empty():
		update_push()
	elif not verifying:
		var v = Vector2(float(Input.is_physical_key_pressed(KEY_RIGHT) or Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_LEFT) or Input.is_physical_key_pressed(KEY_A)), float(Input.is_physical_key_pressed(KEY_DOWN) or Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_UP) or Input.is_physical_key_pressed(KEY_W)))
		if layout != "arena" or (hero_health > 0 and attack_time <= 0 and hurt_time <= 0):
			move_by(v.normalized() * delta * 2.2)
		if layout == "arena":
			update_combat(minf(delta, 0.05))
	align_hero()
	update_combat_props()
	caption.text = "WASD/arrows move | E interact | Space attack | R retry fight | %s" % layout
	objective.text = quest_objective()

func _unhandled_key_input(event):
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode == KEY_E:
			interact()
		if event.physical_keycode == KEY_SPACE:
			start_attack()
		if event.physical_keycode == KEY_R and layout == "arena" and hero_health <= 0:
			retry_combat()
		if event.physical_keycode in [KEY_1, KEY_2, KEY_3] and push_data.is_empty():
			set_layout(["hall", "elbow", "puzzle"][event.physical_keycode - KEY_1])

func set_layout(value: String):
	room_states.clear()
	quest_stage = QuestStage.FIND_KEY
	hall_plate_activated = false
	north_traversal_latched = false
	reset_combat()
	load_room(value)

func load_room(value: String, arriving: bool = false):
	layout = value
	north_traversal_latched = false
	attack_time = 0
	hurt_time = 0
	enemy_windup = 0
	player = ARENA_SPAWN
	crate = Vector2i(3, 4) if value == "elbow" else Vector2i(5, 4)
	plate = Vector2i(4, 4) if value == "elbow" else Vector2i(7, 4)
	if value == "puzzle":
		crate = Vector2i(5,3)
		plate = Vector2i(7,3)
	var saved = room_states.get(value, {})
	if arriving:
		player = Vector2(manifest.walls.gate.passage + 0.5, 0.58)
		direction = "south"
		crate = saved.get("crate", crate)
	crate_sprite.position = ORIGIN + Vector2(crate) * CELL + Vector2(0, -8)
	crate_sprite.visible = layout != "arena"
	plate_sprite.visible = layout != "arena"
	plate_sprite.position = ORIGIN + Vector2(plate) * CELL
	update_mechanism(saved.get("door", true) if arriving else null)
	update_quest_props()
	gate_sprite.modulate = palette_color("door_closed")
	set_motion(Vector2.ZERO)
	queue_redraw()
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

func update_mechanism(saved_door = null):
	if layout == "arena":
		pressed = false
		door = enemy_health <= 0
		gate_sprite.visible = not door
		queue_redraw()
		return
	pressed = crate == plate
	if layout == "hall" and pressed:
		hall_plate_activated = true
	var linked_elbow = layout == "elbow" and room_states.has("hall")
	door = pressed or linked_elbow if saved_door == null else saved_door
	set_module(plate_sprite, "plate_pressed" if pressed else "plate")
	gate_sprite.visible = not door
	queue_redraw()

func combat_point(field: String) -> Vector2:
	var cells: Array = manifest.combat[field]
	return Vector2(cells[0], cells[1])

func reset_combat():
	hero_health = int(manifest.combat.hero_hp)
	enemy_health = int(manifest.combat.enemy_hp)
	enemy_position = combat_point("enemy_spawn")
	enemy_windup = 0
	enemy_recovery = 0
	enemy_hurt = 0
	attack_time = 0
	hurt_time = 0
	hurt_direction = "east"
	invulnerability = 0
	arena_completed = false

func retry_combat():
	reset_combat()
	player = ARENA_SPAWN
	north_traversal_latched = false
	update_mechanism()
	set_motion(Vector2.ZERO)

func start_attack():
	if layout != "arena" or arena_completed or hero_health <= 0 or attack_time > 0 or hurt_time > 0:
		return
	attack_time = manifest.combat.attack_duration
	attack_direction = direction
	attack_resolved = false
	set_motion(Vector2.ZERO)

func resolve_attack():
	if enemy_health <= 0:
		return
	var to_enemy = enemy_position - player
	if not in_attack_sector(to_enemy):
		return
	enemy_health -= 1
	enemy_hurt = .22
	if enemy_health == 0:
		update_mechanism()
	enemy_windup = 0
	enemy_recovery = maxf(enemy_recovery, 0.28)

func attack_forward() -> Vector2:
	return FACING[attack_direction]

func in_attack_sector(offset: Vector2) -> bool:
	return offset.length() <= manifest.combat.attack_range and (
		offset.is_zero_approx() or offset.normalized().dot(attack_forward()) >= manifest.combat.attack_dot
	)

func hurt_hero():
	if invulnerability > 0:
		return
	var retreat = (player - enemy_position).normalized() * .28
	if not blocked(player + retreat):
		player += retreat
	hero_health -= 1
	hurt_direction = attack_direction if attack_time > 0 else direction
	attack_time = 0
	hurt_time = manifest.combat.hurt_duration
	invulnerability = manifest.combat.invulnerability
	set_motion(Vector2.ZERO)

func update_combat(dt: float):
	if arena_completed:
		return
	var settings: Dictionary = manifest.combat
	hurt_time = maxf(hurt_time - dt, 0)
	invulnerability = maxf(invulnerability - dt, 0)
	enemy_hurt = maxf(enemy_hurt - dt, 0)
	if attack_time > 0:
		attack_time = maxf(attack_time - dt, 0)
		if not attack_resolved and settings.attack_duration - attack_time >= settings.attack_impact:
			attack_resolved = true
			resolve_attack()
	if enemy_health <= 0 or hero_health <= 0:
		return
	var distance = enemy_position.distance_to(player)
	if enemy_windup > 0:
		enemy_windup = maxf(enemy_windup - dt, 0)
		if enemy_windup == 0:
			if distance <= settings.enemy_range + .13:
				hurt_hero()
			enemy_recovery = settings.enemy_recovery
	elif enemy_recovery > 0:
		enemy_recovery = maxf(enemy_recovery - dt, 0)
	elif distance <= settings.enemy_range + .002:
		enemy_windup = settings.enemy_windup
	else:
		var next = enemy_position.move_toward(player, minf(settings.enemy_speed * dt, distance - settings.enemy_range))
		if room(floori(next.x), floori(next.y)):
			enemy_position = next

func update_combat_props():
	var in_arena = layout == "arena"
	slime_sprite.visible = in_arena and (enemy_health > 0 or enemy_hurt > 0)
	slime_cue.visible = in_arena and enemy_health > 0
	slime_cue.queue_redraw()
	attack_cue.visible = in_arena and attack_time > 0
	attack_cue.queue_redraw()
	var show_pose = in_arena and (attack_time > 0 or hurt_time > 0 or hero_health <= 0)
	combat_pose.visible = show_pose
	hero.visible = not show_pose
	if slime_sprite.visible:
		var slime_id = "slime_3" if enemy_hurt > 0 else "slime_2" if enemy_windup > 0 or int(Time.get_ticks_msec() / 200.0) % 2 == 0 else "slime_1"
		slime_sprite.modulate.a = 1.0 if enemy_health > 0 else enemy_hurt / .22
		place_ground_sprite(slime_sprite, slime_id, enemy_position, 66)
	if not show_pose:
		return
	var settings: Dictionary = manifest.combat
	var pose: Dictionary
	if hurt_time > 0 or hero_health <= 0:
		var hurt_frame = 0 if hurt_time > settings.hurt_duration * .5 and hero_health > 0 else 1
		pose = settings.hero_actions[hurt_direction].hurt[hurt_frame]
	else:
		var elapsed: float = settings.attack_duration - attack_time
		var attack_frame = 0 if elapsed < settings.attack_impact else 1 if elapsed < settings.attack_recover else 2
		pose = settings.hero_actions[attack_direction].attack[attack_frame]
	var region: Rect2 = rect(pose.rect)
	var source: Texture2D = textures[pose.id]
	if combat_pose.texture == null or combat_pose.texture.atlas != source or combat_pose.texture.region != region:
		var atlas = AtlasTexture.new()
		atlas.atlas = source
		atlas.region = region
		combat_pose.texture = atlas
	var pivot = Vector2(pose.pivot[0], pose.pivot[1])
	combat_pose.scale = Vector2.ONE * float(pose.scale)
	combat_pose.position = ORIGIN + player * CELL - region.size * pivot * float(pose.scale)
	combat_pose.z_index = hero.z_index

func draw_slime_cue():
	var foot = ORIGIN + enemy_position * CELL
	var shadow = Transform2D(0, Vector2(1, .42), 0, foot)
	slime_cue.draw_set_transform_matrix(shadow)
	slime_cue.draw_circle(Vector2.ZERO, 30, Color(.10,.12,.11,.32), true, -1, true)
	if enemy_windup > 0:
		slime_cue.draw_arc(Vector2.ZERO, 36, 0, TAU, 32, Color("#ffd46c"), 4, true)
	slime_cue.draw_set_transform_matrix(Transform2D.IDENTITY)
	for i in range(int(manifest.combat.enemy_hp)):
		slime_cue.draw_rect(Rect2(foot + Vector2(-15 + 11 * i, -64), Vector2(9,4)), Color("#a9e178") if i < enemy_health else Color("#584b4c"))

func draw_attack_cue():
	var settings: Dictionary = manifest.combat
	var elapsed: float = settings.attack_duration - attack_time
	if elapsed < settings.attack_impact or elapsed >= settings.attack_recover:
		return
	var center = ORIGIN + player * CELL
	var angle = attack_forward().angle()
	var half = acos(float(settings.attack_dot))
	var radius = float(settings.attack_range) * CELL
	var sector = PackedVector2Array([center])
	for step in range(25):
		sector.append(center + Vector2.from_angle(angle - half + 2.0 * half * step / 24.0) * radius)
	attack_cue.draw_colored_polygon(sector, Color(1, .76, .30, .17))
	attack_cue.draw_arc(center, radius, angle - half, angle + half, 24, Color(1, .88, .56, .85), 3, true)

func points(values) -> PackedVector2Array:
	var out = PackedVector2Array()
	for p in values:
		out.append(Vector2(p[0], p[1]))
	return out

func palette_color(id: String) -> Color:
	return Color.from_string(manifest.get("palette", {}).get(layout, {}).get(id, "#ffffff"), Color.WHITE)

func cap_polygon(polygon: PackedVector2Array, parent: Node2D):
	if polygon.size() < 3:
		return
	var shape = Polygon2D.new()
	shape.polygon = polygon
	shape.position = ORIGIN
	shape.texture = textures.wall_cap
	shape.modulate = palette_color("wall_cap")
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

func cap_parts(region: PackedVector2Array, excluded: Array = []) -> Array:
	var geometry = manifest.walls.layouts[layout]
	var result: Array = []
	for outer in geometry.cap_outer_contours:
		var parts: Array = Geometry2D.intersect_polygons(points(outer), region)
		var holes = excluded.duplicate()
		for hole in geometry.cap_hole_contours:
			holes.append(points(hole))
		for hole in holes:
			var next: Array = []
			for part in parts:
				next.append_array(Geometry2D.clip_polygons(part, hole))
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
		shape.modulate = palette_color(q.asset)
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

func wall_group(depth: int) -> CanvasGroup:
	var group = CanvasGroup.new()
	var shader = ShaderMaterial.new()
	shader.shader = WALL_FADE_SHADER
	group.material = shader
	group.z_index = depth
	add_child(group)
	return group

func rebuild_wall_layers():
	for layer in [cap_background,cap_front,north_occluder]:
		if is_instance_valid(layer):
			layer.hide()
			layer.queue_free()
	cap_background = Node2D.new()
	add_child(cap_background)
	cap_front = Node2D.new()
	foreground.add_child(cap_front)
	north_occluder = wall_group(6)
	north_occluder.visible = player.y < 0
	north_occluder.material.set_shader_parameter("fade_strength", 1.0)
	var geometry = manifest.walls.layouts[layout]
	var north_rect = rect_polygon(manifest.walls.gate.occlusion_rect)
	add_portal_shadow(cap_background)
	for q in geometry.faces:
		add_face(q, cap_front if q.foreground else cap_background)
		if not q.foreground:
			add_face(q, north_occluder, north_rect)
	var bounds = geometry.bounds
	var foreground_regions: Array = []
	for r in geometry.foreground_rects:
		foreground_regions.append(rect_polygon(r))
	# Closed caps have an interior hole. Small overlapping tiles keep that hole
	# empty while retaining smooth exterior edges and continuous texture phase.
	for y in range(int(floor(bounds[1]/64.0))*64,int(bounds[1]+bounds[3])+64,64):
		for x in range(int(floor(bounds[0]/64.0))*64,int(bounds[0]+bounds[2])+64,64):
			for part in cap_parts(rect_polygon([x,y,64,64],1), foreground_regions):
				cap_polygon(part, cap_background)
	for region in foreground_regions:
		for part in cap_parts(region):
			cap_polygon(part, cap_front)
	for ending in geometry.cutaway_ends:
		cap_polygon(points(ending), cap_background)
	for part in cap_parts(north_rect):
		cap_polygon(part, north_occluder)
	var back_bevel = Node2D.new()
	back_bevel.draw.connect(func(): draw_bevels(back_bevel, false))
	cap_background.add_child(back_bevel)
	var front_bevel = Node2D.new()
	front_bevel.draw.connect(func(): draw_bevels(front_bevel, true))
	cap_front.add_child(front_bevel)
	update_wall_fade()

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
	var tint = palette_color("floor")
	for y in range(8):
		for x in range(12):
			if room(x, y):
				draw_texture_rect_region(texture, Rect2(ORIGIN + Vector2(x, y) * CELL, Vector2.ONE * CELL), Rect2(Vector2(x % 6, y % 6) * tile, tile), tint)
	if door:
		draw_texture_rect_region(texture, Rect2(ORIGIN + Vector2(manifest.walls.gate.passage,-1)*CELL, Vector2.ONE*CELL), Rect2(Vector2(0,5)*tile,tile), tint)
	for lip in manifest.walls.layouts[layout].cutaway_lips:
		var edge = ORIGIN + Vector2(lip[0], lip[1])
		var width: float = lip[2] - lip[0]
		draw_rect(Rect2(edge, Vector2(width, 4)), Color(.10,.12,.14,.70))
		draw_rect(Rect2(edge - Vector2(0, 2), Vector2(width, 2)), Color(.88,.66,.40,.48))

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
	checks.append("%d native module textures, plus 44 calibrated AtlasTexture movement frames" % modules.size())
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
	await validate_wall_fade()
	checks.append("Wall fade follows the hero, stays local, and leaves collision intact")
	await validate_room_link()
	checks.append("North gate travels both ways and preserves each room's crate and gate state")
	await validate_treasure_quest()
	checks.append("Hall crate opens the gallery, key is collected once, and chest opens only after return")
	checks.append("South foreground is hidden while the floor edge still blocks the hero")
	checks.append("Chest unlocks arena travel, windup causes hurt, one hit per swing, defeated slime opens the north exit")
	await validate_directional_combat()
	checks.append("Four attack and hurt directions use independent atlas frames and anchored feet; locked hit sectors reject the opposite side and targets beyond reach")
	checks.append("The cutaway retains rounded side wall ends and a low floor lip")
	if DisplayServer.get_name() != "headless":
		checks.append("Rendered floors use distinct hall and elbow palettes")
	var report = {"status":"passed","engine":Engine.get_version_info().string,"display_server":DisplayServer.get_name(),"checks":checks,"limits":["Art still requires user visual acceptance","Unity Editor not validated","Floor is not a complete autotile set"]}
	FileAccess.open("res://Validation/report.json", FileAccess.WRITE).store_string(JSON.stringify(report,"\t") + "\n")
	print(JSON.stringify(report))
	get_tree().quit()

func validate_wall_fade():
	# Capture opaque and nearby views at the same wall locations.
	foreground.show()
	var opaque: Image
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		opaque = get_viewport().get_texture().get_image()
	player = Vector2(4.5, 7.5)
	set_motion(Vector2.ZERO)
	assert(is_equal_approx(foreground.material.get_shader_parameter("fade_strength"), 1.0))
	assert(foreground.material.get_shader_parameter("fade_center") == Vector2(388, 626))
	assert(blocked(player + Vector2.DOWN))
	if opaque != null:
		await RenderingServer.frame_post_draw
		var faded = get_viewport().get_texture().get_image()
		faded.save_png("res://Validation/wall-fade.png")
		# Transparent cap reveals the warm room floor; the facade below it reveals the dark surround.
		assert(faded.get_pixel(433, 590).r > opaque.get_pixel(433, 590).r + 0.08)
		assert(faded.get_pixel(413, 719).r < opaque.get_pixel(413, 719).r - 0.05)
		assert(faded.get_pixel(660, 590).is_equal_approx(opaque.get_pixel(660, 590)))
	player = Vector2(4.5, 5.5)
	set_motion(Vector2.ZERO)
	assert(is_zero_approx(foreground.material.get_shader_parameter("fade_strength")))
	foreground.hide()

func validate_room_link():
	set_layout("hall")
	var gate_center = manifest.walls.gate.passage + 0.5
	player = Vector2(gate_center, 0.05)
	move_by(Vector2.UP * 0.12)
	assert(layout == "hall" and is_equal_approx(player.y, 0.05))
	player = Vector2(4.5, 4.5)
	assert(push_crate())
	await wait_push()
	assert(push_crate())
	await wait_push()
	assert(pressed and door)
	await capture("linked-hall")
	var hall_floor: Color
	if DisplayServer.get_name() != "headless":
		hall_floor = get_viewport().get_texture().get_image().get_pixel(260, 330)

	player = Vector2(gate_center, -0.72)
	move_by(Vector2.UP * 0.12)
	assert(layout == "elbow" and door and not pressed and direction == "south")
	assert(player.is_equal_approx(Vector2(gate_center, 0.58)))
	await capture("linked-elbow")
	if DisplayServer.get_name() != "headless":
		var elbow_floor = get_viewport().get_texture().get_image().get_pixel(260, 330)
		assert(hall_floor.r > elbow_floor.r + 0.06 and elbow_floor.g > hall_floor.g + 0.06)

	# Continuing to hold north must not immediately take the return passage.
	for i in range(15):
		move_by(Vector2.UP * 0.12)
	assert(layout == "elbow" and is_equal_approx(player.y, 0.58))
	move_by(Vector2.ZERO)
	for i in range(12):
		move_by(Vector2.UP * 0.12)
	assert(layout == "hall" and crate == plate and pressed and door)
	move_by(Vector2.ZERO)
	player = Vector2(gate_center, -0.72)
	move_by(Vector2.UP * 0.12)
	assert(layout == "elbow")

	# The return route stays open when the elbow's independent puzzle changes.
	player = Vector2(2.5, 4.5)
	assert(push_crate())
	await wait_push()
	assert(pressed and door)
	assert(push_crate())
	await wait_push()
	assert(crate == Vector2i(5, 4) and not pressed and door)
	move_by(Vector2.ZERO)
	player = Vector2(gate_center, -0.72)
	move_by(Vector2.UP * 0.12)
	assert(layout == "hall" and crate == Vector2i(7, 4) and door)
	move_by(Vector2.ZERO)
	player = Vector2(gate_center, -0.72)
	move_by(Vector2.UP * 0.12)
	assert(layout == "elbow" and crate == Vector2i(5, 4) and door)
	set_layout("elbow")
	assert(crate == Vector2i(3, 4) and not door and room_states.is_empty())

func validate_treasure_quest():
	set_layout("elbow")
	player = quest_position("key_pos")
	move_by(Vector2.ZERO)
	assert(quest_stage == QuestStage.FIND_KEY and not key_sprite.visible)

	set_layout("hall")
	assert(not foreground.visible and chest_sprite.visible)
	player = Vector2(4.5, 7.75)
	move_by(Vector2.DOWN * 0.35)
	assert(is_equal_approx(player.y, 7.75))
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		var frame_image = get_viewport().get_texture().get_image()
		assert(frame_image.get_pixel(660, 719).is_equal_approx(frame_image.get_pixel(660, 745)))
		assert(not frame_image.get_pixel(660, 695).is_equal_approx(frame_image.get_pixel(660, 719)))
		assert(not frame_image.get_pixel(92, 650).is_equal_approx(frame_image.get_pixel(75, 650)))

	player = quest_position("chest_pos") + Vector2.DOWN * 0.7
	interact()
	assert(quest_stage == QuestStage.FIND_KEY and chest_sprite.texture.atlas == textures.chest_closed)
	player = Vector2(4.5, 4.5)
	interact()
	assert(not push_data.is_empty())
	await wait_push()
	interact()
	assert(not push_data.is_empty())
	await wait_push()
	assert(door and pressed and hall_plate_activated)

	var gate_x = manifest.walls.gate.passage + 0.5
	player = Vector2(gate_x, -0.72)
	move_by(Vector2.UP * 0.12)
	assert(layout == "elbow" and key_sprite.visible and not chest_sprite.visible)
	await capture("quest-key")
	player = quest_position("key_pos") + Vector2.LEFT * 0.65
	move_by(Vector2.RIGHT * 0.2)
	assert(quest_stage == QuestStage.HAS_KEY and not key_sprite.visible)

	player = Vector2(gate_x, -0.72)
	move_by(Vector2.UP * 0.12)
	assert(layout == "hall" and quest_stage == QuestStage.HAS_KEY and crate == plate)
	player = quest_position("chest_pos") + Vector2.DOWN * 1.5
	interact()
	assert(quest_stage == QuestStage.HAS_KEY)
	player = quest_position("chest_pos") + Vector2.RIGHT * 0.95
	interact()
	assert(quest_stage == QuestStage.COMPLETE and chest_sprite.texture.atlas == textures.chest_open)
	interact()
	assert(quest_stage == QuestStage.COMPLETE)
	set_motion(Vector2.ZERO)
	await capture("quest-complete")
	await validate_combat_room()

	set_layout("hall")
	assert(quest_stage == QuestStage.FIND_KEY and not hall_plate_activated and chest_sprite.texture.atlas == textures.chest_closed)

func validate_combat_room():
	assert(arena_portal_sprite.visible and layout == "hall")
	player = combat_point("hall_portal")
	interact()
	assert(layout == "arena" and player == ARENA_SPAWN and not door)
	assert(not crate_sprite.visible and not plate_sprite.visible and not foreground.visible)
	var gate_center = manifest.walls.gate.passage + 0.5
	player = Vector2(gate_center, .05)
	move_by(Vector2.UP * .12)
	assert(not arena_completed and player.y >= 0)

	for i in range(int(manifest.combat.hero_hp)):
		invulnerability = 0
		hurt_hero()
	assert(hero_health == 0 and not door)
	interact()
	assert(player == ARENA_SPAWN and hero_health == manifest.combat.hero_hp and not door)

	player = enemy_position - Vector2.RIGHT * .8
	update_combat(.01)
	assert(enemy_windup > 0)
	await capture("arena-windup")
	update_combat(manifest.combat.enemy_windup)
	assert(hero_health == manifest.combat.hero_hp - 1 and hurt_time > 0)
	await capture("arena-hurt")
	var damaged_health = hero_health
	hurt_hero()
	assert(hero_health == damaged_health)

	player = combat_point("arena_portal")
	interact()
	assert(layout == "hall" and quest_stage == QuestStage.COMPLETE and player == HALL_RETURN and crate == plate)
	player = combat_point("hall_portal")
	interact()
	assert(layout == "arena" and hero_health == damaged_health and not door)

	player = enemy_position - Vector2.RIGHT
	direction = "west"
	start_attack()
	update_combat(manifest.combat.attack_impact + .01)
	assert(enemy_health == manifest.combat.enemy_hp)
	update_combat(manifest.combat.attack_duration)
	direction = "east"
	for i in range(int(manifest.combat.enemy_hp)):
		var before = enemy_health
		start_attack()
		update_combat(manifest.combat.attack_impact + .01)
		assert(enemy_health == before - 1)
		if i == 0:
			await capture("arena-attack")
		update_combat(manifest.combat.attack_duration)
		assert(enemy_health == before - 1)
	assert(door and not gate_sprite.visible and not arena_completed)
	player = Vector2(gate_center, -.72)
	move_by(Vector2.UP * .12)
	assert(layout == "arena" and arena_completed)
	await capture("arena-complete")

func assert_combat_frame(pose: Dictionary):
	assert(combat_pose.visible and not combat_pose.flip_h)
	assert(combat_pose.texture.atlas == textures[pose.id])
	var region = rect(pose.rect)
	assert(combat_pose.texture.region == region)
	var anchor = combat_pose.position + region.size * Vector2(pose.pivot[0], pose.pivot[1]) * float(pose.scale)
	assert(anchor.is_equal_approx(ORIGIN + player * CELL))

func validate_directional_combat():
	load_room("arena")
	var settings: Dictionary = manifest.combat
	var used_regions: Dictionary = {}
	for d in DIRECTIONS:
		var actions: Dictionary = settings.hero_actions[d]
		assert(actions.attack.size() == 3 and actions.hurt.size() == 2)
		for pose in actions.attack + actions.hurt:
			var key = "%s:%s" % [pose.id, pose.rect]
			assert(not used_regions.has(key))
			used_regions[key] = true
			var region = rect(pose.rect)
			assert(Rect2(Vector2.ZERO, textures[pose.id].get_size()).encloses(region))
			assert(region.size.x > 0 and region.size.y > 0 and pose.scale > 0)
			assert(pose.pivot[0] >= 0 and pose.pivot[0] <= 1 and pose.pivot[1] >= 0 and pose.pivot[1] <= 1)

		reset_combat()
		player = Vector2(6.5, 4)
		var forward: Vector2 = FACING[d]
		direction = d
		start_attack()
		assert(attack_direction == d and attack_forward().is_equal_approx(forward))
		var reach: float = settings.attack_range
		assert(in_attack_sector(forward * reach * .99))
		assert(not in_attack_sector(-forward))
		assert(not in_attack_sector(forward * (reach + .02)))
		assert(not in_attack_sector(forward.orthogonal()))
		# A direction change elsewhere must not rotate this in-progress swing.
		direction = DIRECTIONS[(DIRECTIONS.find(d) + 2) % DIRECTIONS.size()]
		update_combat_props()
		assert_combat_frame(actions.attack[0])
		enemy_position = player + forward * (reach * .85)
		update_combat(settings.attack_impact + .01)
		assert(enemy_health == settings.enemy_hp - 1)
		update_combat_props()
		assert_combat_frame(actions.attack[1])
		await capture("directional-attack-" + d)
		attack_time = settings.attack_duration - settings.attack_recover - .01
		update_combat_props()
		assert_combat_frame(actions.attack[2])
		hurt_hero()
		assert(hurt_direction == d and attack_time == 0)
		update_combat_props()
		assert_combat_frame(actions.hurt[0])
		await capture("directional-hurt-" + d)
		hurt_time = settings.hurt_duration * .2
		update_combat_props()
		assert_combat_frame(actions.hurt[1])

		for bad_target in [-forward, forward * (reach + .2)]:
			reset_combat()
			direction = d
			enemy_position = player + bad_target
			start_attack()
			update_combat(settings.attack_impact + .01)
			assert(enemy_health == settings.enemy_hp)
	set_layout("hall")
