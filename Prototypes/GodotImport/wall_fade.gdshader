shader_type canvas_item;
render_mode unshaded;

uniform sampler2D wall_group : hint_screen_texture, repeat_disable, filter_nearest;
uniform vec2 fade_center;
uniform float fade_strength = 0.0;
varying vec2 wall_position;

void vertex() {
	wall_position = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

void fragment() {
	// CanvasGroup stores the assembled wall in the backbuffer with premultiplied alpha.
	vec4 wall = textureLod(wall_group, SCREEN_UV, 0.0);
	if (wall.a > 0.0001) {
		wall.rgb /= wall.a;
	}
	float radius = length((wall_position - fade_center) / vec2(82.0, 110.0));
	wall.a *= 1.0 - 0.82 * fade_strength * (1.0 - smoothstep(0.52, 1.0, radius));
	COLOR *= wall;
}
