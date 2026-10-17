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

/** Earliest 0..1 hit against a wall or trunk. Null when the segment misses. */
export function coverBlockT(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  radius: number,
): number | null {
  let closest: number | null = null
  for (const wall of WALLS) {
    const bounds = wallBounds(wall, radius)
    const t = segmentAabbT(x0, z0, x1, z1, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ)
    if (t === null) continue
    if (closest === null || t < closest) closest = t
  }
  for (const tree of TREES) {
    const t = segmentHitT(x0, z0, x1, z1, tree.x, tree.z, TREE_TRUNK_RADIUS + radius)
    if (t === null) continue
    if (closest === null || t < closest) closest = t
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

function segmentAabbT(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): number | null {
  const dx = x1 - x0
  const dz = z1 - z0
  let tMin = 0
  let tMax = 1
  if (!slab(dx, minX - x0, maxX - x0)) return null
  if (!slab(dz, minZ - z0, maxZ - z0)) return null
  return tMin <= tMax ? tMin : null

  function slab(delta: number, enter: number, exit: number): boolean {
    if (Math.abs(delta) < 1e-8) return enter <= 0 && exit >= 0
    let tEnter = enter / delta
    let tExit = exit / delta
    if (tEnter > tExit) {
      const swap = tEnter
      tEnter = tExit
      tExit = swap
    }
    tMin = Math.max(tMin, tEnter)
    tMax = Math.min(tMax, tExit)
    return tMin <= tMax
  }
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
