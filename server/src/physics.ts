import {
  ARENA_SIZE,
  PLAYER_SPEED,
  TREES,
  TREE_TRUNK_RADIUS,
  WALLS,
  wallBounds,
  type InputMessage,
} from '@bounty/shared'

export interface Vec2 {
  x: number
  z: number
}

type MoveKeys = Pick<InputMessage, 'up' | 'down' | 'left' | 'right'>

/** W moves toward -Z, which is up the screen when the camera sits on +Z. */
export function wishVelocity(input: MoveKeys): Vec2 {
  let x = 0
  let z = 0
  if (input.left) x -= 1
  if (input.right) x += 1
  if (input.up) z -= 1
  if (input.down) z += 1

  const magnitude = Math.hypot(x, z)
  if (magnitude === 0) return { x: 0, z: 0 }

  const scale = PLAYER_SPEED / magnitude
  return { x: x * scale, z: z * scale }
}

export function clampSpeed(velocity: Vec2, maxSpeed: number): Vec2 {
  const magnitude = Math.hypot(velocity.x, velocity.z)
  if (magnitude <= maxSpeed || magnitude === 0) return velocity
  const scale = maxSpeed / magnitude
  return { x: velocity.x * scale, z: velocity.z * scale }
}

export function arenaLimit(entityRadius: number): number {
  return ARENA_SIZE / 2 - entityRadius
}

export function clampToArena(x: number, z: number, radius: number): Vec2 {
  const limit = arenaLimit(radius)
  return {
    x: Math.min(limit, Math.max(-limit, x)),
    z: Math.min(limit, Math.max(-limit, z)),
  }
}

export function isInsideArena(x: number, z: number, radius: number): boolean {
  const limit = arenaLimit(radius)
  return Math.abs(x) <= limit && Math.abs(z) <= limit
}

export function wrapAngle(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians))
}

/** Closest point on the segment, as a 0..1 parameter, when it enters the circle. */
export function segmentHitT(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cx: number,
  cz: number,
  radius: number,
): number | null {
  const dx = x1 - x0
  const dz = z1 - z0
  const lengthSquared = dx * dx + dz * dz
  let t = 0
  if (lengthSquared > 0) {
    t = ((cx - x0) * dx + (cz - z0) * dz) / lengthSquared
    if (t < 0) t = 0
    else if (t > 1) t = 1
  }

  const nearestX = x0 + dx * t
  const nearestZ = z0 + dz * t
  const offsetX = nearestX - cx
  const offsetZ = nearestZ - cz
  if (offsetX * offsetX + offsetZ * offsetZ > radius * radius) return null
  return t
}

/** Push a circle out of walls and tree trunks. Bushes are not solid. */
export function resolveCover(x: number, z: number, radius: number): Vec2 {
  let px = x
  let pz = z
  for (let pass = 0; pass < 2; pass += 1) {
    for (const wall of WALLS) {
      const pushed = pushOutOfAabb(px, pz, radius, wallBounds(wall))
      px = pushed.x
      pz = pushed.z
    }
    for (const tree of TREES) {
      const pushed = pushOutOfCircle(px, pz, radius + TREE_TRUNK_RADIUS, tree.x, tree.z)
      px = pushed.x
      pz = pushed.z
    }
  }
  return { x: px, z: pz }
}

export interface CoverHit {
  t: number
  nx: number
  nz: number
}

/** Earliest 0..1 hit against a wall or trunk, with the outward normal. */
export function coverHit(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  radius: number,
): CoverHit | null {
  let closest: CoverHit | null = null
  for (const wall of WALLS) {
    const bounds = wallBounds(wall, radius)
    const hit = segmentAabbHit(x0, z0, x1, z1, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ)
    if (!hit) continue
    if (!closest || hit.t < closest.t) closest = hit
  }
  for (const tree of TREES) {
    const hit = circleEntry(x0, z0, x1, z1, tree.x, tree.z, TREE_TRUNK_RADIUS + radius)
    if (!hit) continue
    if (!closest || hit.t < closest.t) closest = hit
  }
  return closest
}

/** Earliest 0..1 hit on the inner arena edge. The normal points back into the arena. */
export function arenaBorderHit(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  radius: number,
): CoverHit | null {
  const limit = arenaLimit(radius)
  let closest: CoverHit | null = null
  const faces = [
    { crossed: x1 > limit, delta: x1 - x0, start: limit - x0, nx: -1, nz: 0 },
    { crossed: x1 < -limit, delta: x1 - x0, start: -limit - x0, nx: 1, nz: 0 },
    { crossed: z1 > limit, delta: z1 - z0, start: limit - z0, nx: 0, nz: -1 },
    { crossed: z1 < -limit, delta: z1 - z0, start: -limit - z0, nx: 0, nz: 1 },
  ]
  for (const face of faces) {
    if (!face.crossed || Math.abs(face.delta) < 1e-8) continue
    const t = face.start / face.delta
    if (t < 0 || t > 1) continue
    if (closest && t >= closest.t) continue
    closest = { t, nx: face.nx, nz: face.nz }
  }
  return closest
}

function pushOutOfAabb(
  cx: number,
  cz: number,
  radius: number,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
): Vec2 {
  const nearestX = Math.min(bounds.maxX, Math.max(bounds.minX, cx))
  const nearestZ = Math.min(bounds.maxZ, Math.max(bounds.minZ, cz))
  const dx = cx - nearestX
  const dz = cz - nearestZ
  const distanceSquared = dx * dx + dz * dz
  if (distanceSquared >= radius * radius) return { x: cx, z: cz }

  if (distanceSquared > 1e-8) {
    const distance = Math.sqrt(distanceSquared)
    const push = radius - distance
    return { x: cx + (dx / distance) * push, z: cz + (dz / distance) * push }
  }

  const left = cx - bounds.minX
  const right = bounds.maxX - cx
  const south = cz - bounds.minZ
  const north = bounds.maxZ - cz
  const min = Math.min(left, right, south, north)
  if (min === left) return { x: bounds.minX - radius, z: cz }
  if (min === right) return { x: bounds.maxX + radius, z: cz }
  if (min === south) return { x: cx, z: bounds.minZ - radius }
  return { x: cx, z: bounds.maxZ + radius }
}

function pushOutOfCircle(cx: number, cz: number, reach: number, ox: number, oz: number): Vec2 {
  let dx = cx - ox
  let dz = cz - oz
  const distance = Math.hypot(dx, dz)
  if (distance >= reach) return { x: cx, z: cz }
  if (distance === 0) {
    dx = 1
    dz = 0
  } else {
    dx /= distance
    dz /= distance
  }
  return { x: ox + dx * reach, z: oz + dz * reach }
}

function segmentAabbHit(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): CoverHit | null {
  const dx = x1 - x0
  const dz = z1 - z0
  let tMin = 0
  let tMax = 1
  let nx = 0
  let nz = 0
  if (!slab(dx, minX - x0, maxX - x0, 1, 0)) return null
  if (!slab(dz, minZ - z0, maxZ - z0, 0, 1)) return null
  if (tMin < 0 || tMin > 1 || nx * nx + nz * nz < 0.5) return null
  return { t: tMin, nx, nz }

  function slab(
    delta: number,
    enter: number,
    exit: number,
    axisX: number,
    axisZ: number,
  ): boolean {
    if (Math.abs(delta) < 1e-8) return enter <= 0 && exit >= 0
    let tEnter = enter / delta
    let tExit = exit / delta
    const outward = delta > 0 ? -1 : 1
    if (tEnter > tExit) {
      const swap = tEnter
      tEnter = tExit
      tExit = swap
    }
    if (tEnter > tMin || (tEnter === tMin && nx === 0 && nz === 0)) {
      tMin = tEnter
      nx = axisX * outward
      nz = axisZ * outward
    }
    tMax = Math.min(tMax, tExit)
    return tMin <= tMax
  }
}

function circleEntry(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cx: number,
  cz: number,
  radius: number,
): CoverHit | null {
  const dx = x1 - x0
  const dz = z1 - z0
  const fx = x0 - cx
  const fz = z0 - cz
  const a = dx * dx + dz * dz
  if (a < 1e-10) return null
  const b = 2 * (fx * dx + fz * dz)
  const c = fx * fx + fz * fz - radius * radius
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  if (t < 0 || t > 1) return null
  const nx = x0 + dx * t - cx
  const nz = z0 + dz * t - cz
  const length = Math.hypot(nx, nz)
  if (length < 1e-8) return null
  return { t, nx: nx / length, nz: nz / length }
}

export function separateCircles(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  radius: number,
): { ax: number; az: number; bx: number; bz: number } | null {
  let dx = bx - ax
  let dz = bz - az
  const distance = Math.hypot(dx, dz)
  const minDistance = radius * 2
  if (distance >= minDistance) return null

  if (distance === 0) {
    dx = 1
    dz = 0
  } else {
    dx /= distance
    dz /= distance
  }

  const push = (minDistance - distance) / 2
  return {
    ax: ax - dx * push,
    az: az - dz * push,
    bx: bx + dx * push,
    bz: bz + dz * push,
  }
}
