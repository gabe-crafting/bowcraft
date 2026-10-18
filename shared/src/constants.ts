/** Fixed simulation rate. The client blends between snapshots at this cadence. */
export const TICK_RATE = 30
export const TICK_MS = 1000 / TICK_RATE
export const TICK_SECONDS = TICK_MS / 1000

export const SERVER_PORT = 3001

export const MAX_PLAYERS = 2
export const USERNAME_MAX_LENGTH = 16
export const DEFAULT_USERNAME = 'Player'
export const MAX_CLIENT_MESSAGE_CHARS = 2_000
export const PLAYER_ID_MAX_LENGTH = 64

/** Inner width and depth between the walls, in world units. */
export const ARENA_SIZE = 36
export const WALL_THICKNESS = 0.8
export const WALL_HEIGHT = 0.9
export const SPAWN_INSET = 4

const ARENA_HALF = ARENA_SIZE / 2

export const SPAWN_POINTS: readonly { readonly x: number; readonly z: number }[] = [
  { x: -ARENA_HALF + SPAWN_INSET, z: -ARENA_HALF + SPAWN_INSET },
  { x: ARENA_HALF - SPAWN_INSET, z: ARENA_HALF - SPAWN_INSET },
]

export const PLAYER_SPEED = 8
export const PLAYER_RADIUS = 0.4

export const MAX_HP = 100
export const PROJECTILE_RADIUS = 0.1
export const PROJECTILE_SPAWN_CLEARANCE = 0.08
export const PROJECTILE_Y = 1
/** Pulls every arrow down. A flat shot from chest height lands in a short distance. */
export const ARROW_GRAVITY = 9.2
/** How long a fallen arrow stays visible before it is cleared. */
export const ARROW_REST_MS = 650
/** Hunters and dummies can be hit while the arrow is at or below this height. */
export const HUNTER_HIT_HEIGHT = 1.7
/** Walls and trunks stop an arrow only while it is at or below this height. */
export const COVER_PASS_HEIGHT = 1.35
export const TREE_TRUNK_HEIGHT = 1.15

/** Heavy draw. Lobs onto the clicked ground. */
export const LONGBOW_DAMAGE = 45
export const LONGBOW_SPEED = 36
export const LONGBOW_RANGE = 42
export const LONGBOW_COOLDOWN_MS = 720
/** Extra hang time so a longbow rises before it falls. */
export const LONGBOW_LOFT = 0.85

/** Light draw. Flies straight along the hunter's facing and drops early. */
export const SHORTBOW_DAMAGE = 22
export const SHORTBOW_SPEED = 30
export const SHORTBOW_RANGE = 24
export const SHORTBOW_COOLDOWN_MS = 320

/** Curved shot. Longer reach, slower to loose, and one hook around cover. */
export const RECURVE_DAMAGE = 36
export const RECURVE_SPEED = 34
export const RECURVE_RANGE = 56
export const RECURVE_COOLDOWN_MS = 1100
export const RECURVE_LOFT = 0.55
export const EXPLOSION_RADIUS = 2.5
/** How long the blast stays on screen. */
export const EXPLOSION_ANIM_MS = 640
/** Straw target. Arrows and blasts can wound it. */
export const DUMMY_HP = 70
export const DUMMY_RADIUS = 0.34
export const PICKUP_RADIUS = 1.6
/** Arrows in one pile on the ground. */
export const ARROW_STACK_SIZE = 4
/** Flare arrows crawl so a hunter can follow them through the fog. */
export const FLARE_SPEED_SCALE = 0.22
export const FLARE_RANGE_SCALE = 0.8
export const FLARE_DAMAGE_SCALE = 0.3
/** Clear circle around a flying flare. It fades across FLARE_LIGHT_FALLOFF. */
export const FLARE_LIGHT_RADIUS = 7
export const FLARE_LIGHT_FALLOFF = 1.8
export const RESPAWN_DELAY_MS = 2_000

/** Clear sight straight ahead. It fades across VISION_FALLOFF past this. */
export const VISION_RADIUS = 12
export const VISION_FALLOFF = 2.4
/** Clear cone from straight ahead to each side. The edge fades across VISION_ANGLE_FALLOFF. */
export const VISION_HALF_ANGLE = Math.PI / 3
export const VISION_ANGLE_FALLOFF = Math.PI / 12
/** Keeps the hunter's own body visible. It does not reveal the ground around them. */
export const VISION_SELF_RADIUS = 0.62
export const FOG_COLOR = 0x10141a
export const FOG_OPACITY = 0.88

/** If a player moves farther than this between snapshots, the client snaps instead of blending. */
export const TELEPORT_SNAP_DISTANCE = 3

export const CAMERA_FOV = 46
export const CAMERA_NEAR = 0.1
export const CAMERA_FAR = 200
export const CAMERA_HEIGHT = 9
export const CAMERA_DISTANCE = 7
export const CAMERA_LOOK_HEIGHT = 0.9
export const MAX_PIXEL_RATIO = 2
export const NAMEPLATE_HEIGHT = 2.25

export const PLAYER_COLORS = [0x2f6fed, 0xd64545] as const

export const GROUND_COLOR = 0x6b7d58
export const WALL_COLOR = 0x8a8175
export const COVER_WALL_COLOR = 0x6f675e
export const COVER_WALL_HEIGHT = 1.35
export const TREE_TRUNK_RADIUS = 0.46
export const TREE_TRUNK_COLOR = 0x6a4328
export const TREE_LEAF_COLOR = 0x3c7338
export const TREE_LEAF_DARK = 0x2b552c
export const BUSH_COLOR = 0x4d8a42
export const BUSH_DARK = 0x2f5c2c
/** Hide circle at scale 1. A hunter inside it cannot be seen. */
export const BUSH_HIDE_RADIUS = 1.55
/** Loosing an arrow reveals a hunter who is standing in a bush. */
export const BUSH_REVEAL_MS = 2_000
export const SKY_COLOR = 0xb7c4ce
export const PROJECTILE_COLOR = 0xf2c14e
export const AMBIENT_COLOR = 0xd5dde6
export const AMBIENT_INTENSITY = 0.7
export const SUN_COLOR = 0xfff4e0
export const SUN_INTENSITY = 1.15
export const SUN_POSITION_X = 14
export const SUN_POSITION_Y = 24
export const SUN_POSITION_Z = 8
