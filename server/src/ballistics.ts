import {
  ARROW_GRAVITY,
  LONGBOW_LOFT,
  PLAYER_RADIUS,
  PROJECTILE_SPAWN_CLEARANCE,
  PROJECTILE_Y,
  RECURVE_LOFT,
  type ProjectileSpec,
} from '@bounty/shared'
import { coverHit, isInsideArena } from './physics'

export interface Launch {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  landX: number
  landZ: number
  bendX: number | null
  bendZ: number | null
}

/** Seconds until a ballistic arrow reaches the ground. */
export function timeToGround(y: number, vy: number, gravity = ARROW_GRAVITY): number {
  if (y <= 0 && vy <= 0) return 0
  const disc = vy * vy + 2 * gravity * Math.max(y, 0)
  return (vy + Math.sqrt(Math.max(disc, 0))) / gravity
}

export function planLaunch(
  spec: ProjectileSpec,
  originX: number,
  originZ: number,
  aim: number,
  targetX: number,
  targetZ: number,
): Launch {
  if (spec.trajectory === 'flat') return planFlat(originX, originZ, aim, spec)
  const loft = spec.trajectory === 'hook' ? RECURVE_LOFT : LONGBOW_LOFT
  return planDrop(spec, originX, originZ, aim, targetX, targetZ, loft, spec.trajectory === 'hook')
}

function planFlat(originX: number, originZ: number, aim: number, spec: ProjectileSpec): Launch {
  const dirX = Math.sin(aim)
  const dirZ = Math.cos(aim)
  const clearance = PLAYER_RADIUS + spec.radius + PROJECTILE_SPAWN_CLEARANCE
  const x = originX + dirX * clearance
  const z = originZ + dirZ * clearance
  const flight = timeToGround(PROJECTILE_Y, 0)
  return {
    x,
    y: PROJECTILE_Y,
    z,
    vx: dirX * spec.speed,
    vy: 0,
    vz: dirZ * spec.speed,
    landX: x + dirX * spec.speed * flight,
    landZ: z + dirZ * spec.speed * flight,
    bendX: null,
    bendZ: null,
  }
}

function planDrop(
  spec: ProjectileSpec,
  originX: number,
  originZ: number,
  aim: number,
  targetX: number,
  targetZ: number,
  loft: number,
  hook: boolean,
): Launch {
  const clearance = PLAYER_RADIUS + spec.radius + PROJECTILE_SPAWN_CLEARANCE
  let dx = targetX - originX
  let dz = targetZ - originZ
  let distance = Math.hypot(dx, dz)
  if (distance < 0.75) {
    dx = Math.sin(aim)
    dz = Math.cos(aim)
    distance = 1
  }
  if (distance > spec.maxRange) {
    dx = (dx / distance) * spec.maxRange
    dz = (dz / distance) * spec.maxRange
    distance = spec.maxRange
  }
  const dirX = dx / distance
  const dirZ = dz / distance
  const x = originX + dirX * clearance
  const z = originZ + dirZ * clearance
  const landX = originX + dx
  const landZ = originZ + dz
  const bend = hook ? hookAround(x, z, landX, landZ, spec.radius) : null
  const path = bend
    ? Math.hypot(bend.x - x, bend.z - z) + Math.hypot(landX - bend.x, landZ - bend.z)
    : Math.hypot(landX - x, landZ - z)
  const flight = loft + path / spec.speed
  const horizontal = path / flight
  const towardX = bend ? bend.x - x : landX - x
  const towardZ = bend ? bend.z - z : landZ - z
  const toward = Math.hypot(towardX, towardZ) || 1
  const vy = (0 - PROJECTILE_Y) / flight + 0.5 * ARROW_GRAVITY * flight
  return {
    x,
    y: PROJECTILE_Y,
    z,
    vx: (towardX / toward) * horizontal,
    vy,
    vz: (towardZ / toward) * horizontal,
    landX,
    landZ,
    bendX: bend?.x ?? null,
    bendZ: bend?.z ?? null,
  }
}

/** One waypoint that lets both legs miss cover. Null when the straight line is open. */
function hookAround(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  radius: number,
): { x: number; z: number } | null {
  const blocked = coverHit(fromX, fromZ, toX, toZ, radius)
  if (!blocked) return null
  const dx = toX - fromX
  const dz = toZ - fromZ
  const length = Math.hypot(dx, dz) || 1
  const px = -dz / length
  const pz = dx / length
  const hitX = fromX + dx * blocked.t
  const hitZ = fromZ + dz * blocked.t
  let best: { x: number; z: number; length: number } | null = null
  for (const sign of [1, -1]) {
    for (const gap of [2.4, 4, 6, 8]) {
      const wx = hitX + px * sign * gap + blocked.nx * 1.15
      const wz = hitZ + pz * sign * gap + blocked.nz * 1.15
      if (!isInsideArena(wx, wz, radius)) continue
      if (coverHit(fromX, fromZ, wx, wz, radius)) continue
      if (coverHit(wx, wz, toX, toZ, radius)) continue
      const path = Math.hypot(wx - fromX, wz - fromZ) + Math.hypot(toX - wx, toZ - wz)
      if (!best || path < best.length) best = { x: wx, z: wz, length: path }
    }
  }
  return best
}
