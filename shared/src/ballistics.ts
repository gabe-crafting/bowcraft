import { ARROW_GRAVITY, COVER_PASS_HEIGHT, LONGBOW_LOFT, PLAYER_RADIUS, PROJECTILE_SPAWN_CLEARANCE, PROJECTILE_Y } from './constants'
import { arenaBorderHit, circleEntry, coverHit, isInsideArena } from './cover'
import type { ProjectileSpec } from './weapon'

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

export interface FlightPoint {
  x: number
  y: number
  z: number
}

/** A hunter or dummy the preview arrow can strike. */
export interface FlightBlocker {
  x: number
  z: number
  radius: number
  height: number
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
  if (spec.trajectory === 'hook') return planDrop(spec, originX, originZ, aim, targetX, targetZ, 0, true, true)
  return planDrop(spec, originX, originZ, aim, targetX, targetZ, LONGBOW_LOFT, false, false)
}

/** Where this loose would travel, ending at the ground or the first thing it hits. */
export function previewPath(
  spec: ProjectileSpec,
  originX: number,
  originZ: number,
  aim: number,
  targetX: number,
  targetZ: number,
  blockers: readonly FlightBlocker[] = [],
): FlightPoint[] {
  const launch = planLaunch(spec, originX, originZ, aim, targetX, targetZ)
  const points: FlightPoint[] = [{ x: launch.x, y: launch.y, z: launch.z }]
  let x = launch.x
  let y = launch.y
  let z = launch.z
  let vx = launch.vx
  let vy = launch.vy
  let vz = launch.vz
  let bendX = launch.bendX
  let bendZ = launch.bendZ
  let turned = false
  let age = 0

  for (let bounce = 0; bounce < 5 && age < 8 && points.length < 180; bounce += 1) {
    let remaining = Math.max(0, 8 - age)
    let bounced = false
    while (remaining > 1e-4 && y > 0.02 && points.length < 180) {
      const ground = timeToGround(y, vy)
      const step = Math.min(ground > 0 ? ground : remaining, remaining, 0.05)
      if (bendX !== null && bendZ !== null && !turned) {
        const reach = Math.hypot(bendX - x, bendZ - z)
        const horizontal = Math.hypot(vx, vz)
        const bendTime = horizontal > 1e-5 ? reach / horizontal : Number.POSITIVE_INFINITY
        if (bendTime < step) {
          const moved = move(spec, x, y, z, vx, vy, vz, bendTime, blockers)
          x = moved.x
          y = moved.y
          z = moved.z
          vy = moved.vy
          age += moved.used
          points.push({ x, y, z })
          if (moved.kind === 'stopped') return points
          if (moved.kind === 'bounced') {
            vx = moved.vx
            vz = moved.vz
            bendX = null
            bendZ = null
            turned = true
            bounced = true
            break
          }
          turned = true
          bendX = null
          bendZ = null
          const dx = launch.landX - x
          const dz = launch.landZ - z
          const distance = Math.hypot(dx, dz)
          const left = Math.max(timeToGround(y, vy), 1e-3)
          const speed = distance / left
          vx = distance > 1e-6 ? (dx / distance) * speed : 0
          vz = distance > 1e-6 ? (dz / distance) * speed : 0
          remaining -= moved.used
          continue
        }
      }
      const moved = move(spec, x, y, z, vx, vy, vz, step, blockers)
      x = moved.x
      y = moved.y
      z = moved.z
      vy = moved.vy
      age += moved.used
      points.push({ x, y, z })
      if (moved.kind === 'stopped') {
        if (y <= 0.02) points[points.length - 1] = { x, y: 0, z }
        return points
      }
      if (moved.kind === 'bounced') {
        vx = moved.vx
        vz = moved.vz
        bendX = null
        bendZ = null
        turned = true
        bounced = true
        break
      }
      remaining -= moved.used
    }
    if (!bounced) break
  }
  return points
}

function planFlat(originX: number, originZ: number, aim: number, spec: ProjectileSpec): Launch {
  const dirX = Math.sin(aim)
  const dirZ = Math.cos(aim)
  const clearance = PLAYER_RADIUS + spec.radius + PROJECTILE_SPAWN_CLEARANCE
  const x = originX + dirX * clearance
  const z = originZ + dirZ * clearance
  const landX = originX + dirX * spec.maxRange
  const landZ = originZ + dirZ * spec.maxRange
  const path = Math.hypot(landX - x, landZ - z) || spec.speed
  const flight = path / spec.speed
  const vy = (0 - PROJECTILE_Y) / flight + 0.5 * ARROW_GRAVITY * flight
  return {
    x,
    y: PROJECTILE_Y,
    z,
    vx: dirX * spec.speed,
    vy,
    vz: dirZ * spec.speed,
    landX,
    landZ,
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
  alongAim: boolean,
): Launch {
  const clearance = PLAYER_RADIUS + spec.radius + PROJECTILE_SPAWN_CLEARANCE
  let dx = targetX - originX
  let dz = targetZ - originZ
  let distance = Math.hypot(dx, dz)
  if (alongAim) {
    dx = Math.sin(aim) * spec.maxRange
    dz = Math.cos(aim) * spec.maxRange
    distance = spec.maxRange
  } else if (distance < 0.75) {
    dx = Math.sin(aim)
    dz = Math.cos(aim)
    distance = 1
  } else if (Number.isFinite(spec.maxRange) && distance > spec.maxRange) {
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

interface Step {
  kind: 'clear' | 'stopped' | 'bounced'
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  used: number
}

function move(
  spec: ProjectileSpec,
  x0: number,
  y0: number,
  z0: number,
  vx: number,
  vy: number,
  vz: number,
  dt: number,
  blockers: readonly FlightBlocker[],
): Step {
  if (dt <= 1e-5) return { kind: 'clear', x: x0, y: y0, z: z0, vx, vy, vz, used: 0 }
  const x1 = x0 + vx * dt
  const z1 = z0 + vz * dt
  const y1 = y0 + vy * dt - 0.5 * ARROW_GRAVITY * dt * dt
  const yAt = (t: number) => y0 + (y1 - y0) * t
  const cover = spec.penetrates ? null : coverHit(x0, z0, x1, z1, spec.radius)
  const border = spec.penetrates ? null : arenaBorderHit(x0, z0, x1, z1, spec.radius)

  let stopT = 1
  let mode: 'clear' | 'blocker' | 'cover' | 'border' = 'clear'
  let normalX = 0
  let normalZ = 0
  for (const blocker of blockers) {
    const hit = circleEntry(x0, z0, x1, z1, blocker.x, blocker.z, blocker.radius)
    if (!hit || yAt(hit.t) > blocker.height || hit.t >= stopT) continue
    stopT = hit.t
    mode = 'blocker'
    normalX = hit.nx
    normalZ = hit.nz
  }
  if (cover && yAt(cover.t) <= COVER_PASS_HEIGHT && cover.t <= stopT) {
    stopT = cover.t
    mode = 'cover'
    normalX = cover.nx
    normalZ = cover.nz
  }
  if (border && yAt(border.t) <= COVER_PASS_HEIGHT && border.t <= stopT) {
    stopT = border.t
    mode = 'border'
    normalX = border.nx
    normalZ = border.nz
  }

  if (mode === 'clear') {
    const nextY = Math.max(0, y1)
    return {
      kind: nextY <= 0.02 ? 'stopped' : 'clear',
      x: x1,
      y: nextY,
      z: z1,
      vx,
      vy: vy - ARROW_GRAVITY * dt,
      vz,
      used: dt,
    }
  }

  const used = dt * stopT
  const hitX = x0 + (x1 - x0) * stopT
  const hitZ = z0 + (z1 - z0) * stopT
  const nextVy = vy - ARROW_GRAVITY * used
  if (mode === 'blocker' || spec.explodes || !spec.ricochets || used <= 1e-4) {
    return { kind: 'stopped', x: hitX, y: Math.max(0, yAt(stopT)), z: hitZ, vx, vy: nextVy, vz, used }
  }

  const horizontal = Math.hypot(vx, vz)
  const reflected = reflect(vx, vz, normalX, normalZ)
  const length = Math.hypot(reflected.x, reflected.z)
  if (length < 1e-6) {
    return { kind: 'stopped', x: hitX, y: Math.max(0, yAt(stopT)), z: hitZ, vx, vy: nextVy, vz, used }
  }
  return {
    kind: 'bounced',
    x: hitX + normalX * 0.04,
    y: Math.max(0, yAt(stopT)),
    z: hitZ + normalZ * 0.04,
    vx: (reflected.x / length) * horizontal,
    vy: nextVy,
    vz: (reflected.z / length) * horizontal,
    used,
  }
}

function reflect(dirX: number, dirZ: number, normalX: number, normalZ: number): { x: number; z: number } {
  const dot = dirX * normalX + dirZ * normalZ
  if (dot >= 0) return { x: dirX, z: dirZ }
  return { x: dirX - 2 * dot * normalX, z: dirZ - 2 * dot * normalZ }
}
