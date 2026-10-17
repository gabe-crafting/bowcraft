import {
  TREE_TRUNK_RADIUS,
  VISION_ANGLE_FALLOFF,
  VISION_FALLOFF,
  VISION_HALF_ANGLE,
  VISION_RADIUS,
} from './constants'
import { TREES, WALLS, wallBounds } from './map'

const SIGHT_REACH = VISION_RADIUS + VISION_FALLOFF
const SIGHT_LIMIT = Math.cos(VISION_HALF_ANGLE + VISION_ANGLE_FALLOFF)

/**
 * True when a point is inside the forward view, including the soft edge.
 * Walls and tree trunks block the ray. `margin` shortens it so the target
 * itself, or the cover it is touching, does not hide it.
 * The fog shader repeats this test.
 */
export function isInSight(
  originX: number,
  originZ: number,
  aim: number,
  targetX: number,
  targetZ: number,
  margin: number,
): boolean {
  const dx = targetX - originX
  const dz = targetZ - originZ
  const distance = Math.hypot(dx, dz)
  if (distance > SIGHT_REACH) return false
  if (distance <= Math.max(margin, 0.05)) return true

  const forwardX = Math.sin(aim)
  const forwardZ = Math.cos(aim)
  const facing = (dx / distance) * forwardX + (dz / distance) * forwardZ
  if (facing < SIGHT_LIMIT) return false

  const reach = distance - margin
  const x1 = originX + (dx / distance) * reach
  const z1 = originZ + (dz / distance) * reach
  return !sightBlocked(originX, originZ, x1, z1)
}

function sightBlocked(x0: number, z0: number, x1: number, z1: number): boolean {
  for (const wall of WALLS) {
    const bounds = wallBounds(wall)
    if (segmentHitsAabb(x0, z0, x1, z1, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ)) {
      return true
    }
  }
  for (const tree of TREES) {
    if (segmentHitsCircle(x0, z0, x1, z1, tree.x, tree.z, TREE_TRUNK_RADIUS)) return true
  }
  return false
}

function segmentHitsAabb(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): boolean {
  const dx = x1 - x0
  const dz = z1 - z0
  let tMin = 0
  let tMax = 1
  if (!slab(dx, minX - x0, maxX - x0)) return false
  if (!slab(dz, minZ - z0, maxZ - z0)) return false
  return tMin >= 0 && tMin <= 1

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

function segmentHitsCircle(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  const dx = x1 - x0
  const dz = z1 - z0
  const fx = x0 - cx
  const fz = z0 - cz
  const a = dx * dx + dz * dz
  if (a < 1e-8) return false
  const b = 2 * (fx * dx + fz * dz)
  const c = fx * fx + fz * fz - radius * radius
  const disc = b * b - 4 * a * c
  if (disc < 0) return false
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  return t >= 0 && t <= 1
}
