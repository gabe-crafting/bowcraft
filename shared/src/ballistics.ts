import {
  ARROW_GRAVITY,
  COVER_PASS_HEIGHT,
  LONGBOW_LOFT,
  PLAYER_RADIUS,
  PROJECTILE_SPAWN_CLEARANCE,
  PROJECTILE_Y,
  RECURVE_CORNER_PUSH,
  RECURVE_CURVE_MIN_RADIUS,
  RECURVE_CURVE_RADIUS,
  RECURVE_CURVE_STEP,
  RECURVE_GATE_GAP,
  TREE_TRUNK_RADIUS,
} from './constants'
import { arenaBorderHit, circleEntry, coverHit, firstObstacle, isInsideArena, type BlockingCover } from './cover'
import { wallBounds, type WallBlock } from './map'
import type { ProjectileSpec } from './weapon'

/** One circular bend. `entry` is the angle of the first tangent point, `sweep` carries it to the second. */
export interface FlightCurve {
  cx: number
  cz: number
  radius: number
  sweep: number
  entry: number
}

export interface Launch {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  landX: number
  landZ: number
  /** Straight flight ends here. Null when the shot never turns. */
  bendX: number | null
  bendZ: number | null
  /** Set when the turn is a circle. Null when the shot turns sharply or not at all. */
  curve: FlightCurve | null
}

/** Where the arrow is on its bend, and the unit tangent it should be flying. */
export function curveAdvance(
  curve: FlightCurve,
  angle: number,
  speed: number,
  dt: number,
): { angle: number; x: number; z: number; tx: number; tz: number; done: boolean } {
  const remain = curve.sweep - angle
  const sign = remain >= 0 ? 1 : -1
  const maxStep = (speed * dt) / curve.radius
  const nextAngle = angle + sign * Math.min(Math.abs(remain), maxStep)
  const a = curve.entry + nextAngle
  let tx = -Math.sin(a)
  let tz = Math.cos(a)
  if (curve.sweep < 0) {
    tx = -tx
    tz = -tz
  }
  return {
    angle: nextAngle,
    x: curve.cx + Math.cos(a) * curve.radius,
    z: curve.cz + Math.sin(a) * curve.radius,
    tx,
    tz,
    done: Math.abs(curve.sweep - nextAngle) <= 1e-4,
  }
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
  if (spec.trajectory === 'hook') return planHook(spec, originX, originZ, aim, targetX, targetZ)
  return planDrop(spec, originX, originZ, aim, targetX, targetZ, LONGBOW_LOFT, false)
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
  let curve = launch.curve
  let curveAngle = 0
  let turned = false
  let age = 0

  for (let bounce = 0; bounce < 5 && age < 8 && points.length < 180; bounce += 1) {
    let remaining = Math.max(0, 8 - age)
    let bounced = false
    while (remaining > 1e-4 && y > 0.02 && points.length < 180) {
      const ground = timeToGround(y, vy)
      const step = Math.min(ground > 0 ? ground : remaining, remaining, 0.05)
      if (curve && bendX === null && !turned) {
        const speed = Math.hypot(vx, vz) || spec.speed
        const arcLeft = Math.abs(curve.sweep - curveAngle) * curve.radius
        const arcTime = speed > 1e-5 ? arcLeft / speed : Number.POSITIVE_INFINITY
        const curveDt = Math.min(step, arcTime, RECURVE_CURVE_STEP / speed)
        if (curveDt < 1e-5) {
          curve = null
          turned = true
          const dx = launch.landX - x
          const dz = launch.landZ - z
          const distance = Math.hypot(dx, dz)
          vx = distance > 1e-4 ? (dx / distance) * speed : vx
          vz = distance > 1e-4 ? (dz / distance) * speed : vz
          continue
        }
        const next = curveAdvance(curve, curveAngle, speed, curveDt)
        const moved = move(
          spec,
          x,
          y,
          z,
          (next.x - x) / curveDt,
          vy,
          (next.z - z) / curveDt,
          curveDt,
          blockers,
        )
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
          curve = null
          bendX = null
          bendZ = null
          turned = true
          bounced = true
          break
        }
        curveAngle = next.angle
        if (next.done) {
          curve = null
          turned = true
          const dx = launch.landX - x
          const dz = launch.landZ - z
          const distance = Math.hypot(dx, dz)
          vx = distance > 1e-4 ? (dx / distance) * speed : next.tx * speed
          vz = distance > 1e-4 ? (dz / distance) * speed : next.tz * speed
        } else {
          vx = next.tx * speed
          vz = next.tz * speed
        }
        remaining -= moved.used
        continue
      }
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
            curve = null
            turned = true
            bounced = true
            break
          }
          bendX = null
          bendZ = null
          if (curve) {
            const speed = Math.hypot(vx, vz) || spec.speed
            const pose = curveAdvance(curve, 0, speed, 0)
            vx = pose.tx * speed
            vz = pose.tz * speed
          } else {
            turned = true
            const speed = Math.hypot(vx, vz) || spec.speed
            const dx = launch.landX - x
            const dz = launch.landZ - z
            const distance = Math.hypot(dx, dz)
            vx = distance > 1e-6 ? (dx / distance) * speed : 0
            vz = distance > 1e-6 ? (dz / distance) * speed : 0
          }
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
        curve = null
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
    curve: null,
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
  const path = Math.hypot(landX - x, landZ - z)
  const flight = loft + path / spec.speed
  const horizontal = path / flight
  const towardX = landX - x
  const towardZ = landZ - z
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
    bendX: null,
    bendZ: null,
    curve: null,
  }
}

/** Aims at the click. Bends once when the first wall or trunk blocks that line. */
function planHook(
  spec: ProjectileSpec,
  originX: number,
  originZ: number,
  aim: number,
  targetX: number,
  targetZ: number,
): Launch {
  const clearance = PLAYER_RADIUS + spec.radius + PROJECTILE_SPAWN_CLEARANCE
  let dx = targetX - originX
  let dz = targetZ - originZ
  let distance = Math.hypot(dx, dz)
  if (distance < 0.75) {
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
  const aimX = originX + dx
  const aimZ = originZ + dz
  const budget = Number.isFinite(spec.maxRange) ? spec.maxRange : distance
  const blocked = firstObstacle(x, z, aimX, aimZ, spec.radius)
  const gate = blocked ? chooseGate(x, z, aimX, aimZ, blocked, spec.radius) : null
  if (!gate) {
    const land = pointAlong(x, z, aimX, aimZ, budget)
    return launchStraight(spec, x, z, land.x, land.z, null, null, null, Math.hypot(land.x - x, land.z - z))
  }

  const fillet = buildFillet(x, z, gate.x, gate.z, aimX, aimZ, spec.radius)
  if (!fillet) {
    return launchBent(spec, x, z, gate.x, gate.z, gate.x, gate.z, aimX, aimZ, null, budget)
  }
  return launchBent(
    spec,
    x,
    z,
    fillet.t1x,
    fillet.t1z,
    fillet.t2x,
    fillet.t2z,
    aimX,
    aimZ,
    fillet.curve,
    budget,
  )
}

function launchStraight(
  spec: ProjectileSpec,
  x: number,
  z: number,
  landX: number,
  landZ: number,
  bendX: number | null,
  bendZ: number | null,
  curve: FlightCurve | null,
  pathLength: number,
): Launch {
  const headX = bendX ?? landX
  const headZ = bendZ ?? landZ
  const dx = headX - x
  const dz = headZ - z
  const distance = Math.hypot(dx, dz) || 1
  const flight = Math.max(pathLength, 0.05) / spec.speed
  return {
    x,
    y: PROJECTILE_Y,
    z,
    vx: (dx / distance) * spec.speed,
    vy: (0 - PROJECTILE_Y) / flight + 0.5 * ARROW_GRAVITY * flight,
    vz: (dz / distance) * spec.speed,
    landX,
    landZ,
    bendX,
    bendZ,
    curve,
  }
}

/** Spends the path budget across the straight leg, the bend, and the leg after it. */
function launchBent(
  spec: ProjectileSpec,
  x: number,
  z: number,
  t1x: number,
  t1z: number,
  t2x: number,
  t2z: number,
  aimX: number,
  aimZ: number,
  curve: FlightCurve | null,
  budget: number,
): Launch {
  const leg1 = Math.hypot(t1x - x, t1z - z)
  const arc = curve ? curve.radius * Math.abs(curve.sweep) : 0
  const second = Math.hypot(aimX - t2x, aimZ - t2z)
  const spent = Math.min(budget, leg1 + arc + second)
  if (spent <= leg1) {
    const land = pointAlong(x, z, t1x, t1z, spent)
    return launchStraight(spec, x, z, land.x, land.z, null, null, null, spent)
  }
  if (curve && spent <= leg1 + arc) {
    const along = (spent - leg1) / curve.radius
    const sweep = curve.sweep >= 0 ? along : -along
    const shortened: FlightCurve = { ...curve, sweep }
    const end = curveAdvance(shortened, 0, 1, along * shortened.radius)
    return launchStraight(spec, x, z, end.x, end.z, t1x, t1z, shortened, spent)
  }
  const land = pointAlong(t2x, t2z, aimX, aimZ, spent - leg1 - arc)
  return launchStraight(spec, x, z, land.x, land.z, t1x, t1z, curve, spent)
}

function pointAlong(x0: number, z0: number, x1: number, z1: number, distance: number): { x: number; z: number } {
  const dx = x1 - x0
  const dz = z1 - z0
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return { x: x0, z: z0 }
  const scale = Math.min(1, distance / length)
  return { x: x0 + dx * scale, z: z0 + dz * scale }
}

function chooseGate(
  spawnX: number,
  spawnZ: number,
  aimX: number,
  aimZ: number,
  obstacle: BlockingCover,
  radius: number,
): { x: number; z: number } | null {
  const gates = obstacle.kind === 'wall' ? wallGates(obstacle.wall, radius) : treeGates(obstacle.x, obstacle.z, spawnX, spawnZ, aimX, aimZ, radius)
  let best: { x: number; z: number; length: number } | null = null
  for (const gate of gates) {
    if (!isInsideArena(gate.x, gate.z, radius)) continue
    if (coverHit(spawnX, spawnZ, gate.x, gate.z, radius)) continue
    if (coverHit(gate.x, gate.z, aimX, aimZ, radius)) continue
    const length = Math.hypot(gate.x - spawnX, gate.z - spawnZ) + Math.hypot(aimX - gate.x, aimZ - gate.z)
    if (!best || length < best.length) best = { x: gate.x, z: gate.z, length }
  }
  return best
}

function wallGates(wall: WallBlock, radius: number): { x: number; z: number }[] {
  const bounds = wallBounds(wall, radius + RECURVE_GATE_GAP)
  const corners: readonly (readonly [number, number])[] = [
    [bounds.minX, bounds.minZ],
    [bounds.maxX, bounds.minZ],
    [bounds.maxX, bounds.maxZ],
    [bounds.minX, bounds.maxZ],
  ]
  return corners.map(([cornerX, cornerZ]) => {
    let outX = cornerX - wall.x
    let outZ = cornerZ - wall.z
    const length = Math.hypot(outX, outZ) || 1
    outX /= length
    outZ /= length
    return {
      x: cornerX + outX * RECURVE_CORNER_PUSH,
      z: cornerZ + outZ * RECURVE_CORNER_PUSH,
    }
  })
}

function treeGates(
  treeX: number,
  treeZ: number,
  spawnX: number,
  spawnZ: number,
  aimX: number,
  aimZ: number,
  radius: number,
): { x: number; z: number }[] {
  const dx = aimX - spawnX
  const dz = aimZ - spawnZ
  const length = Math.hypot(dx, dz) || 1
  const sideX = -dz / length
  const sideZ = dx / length
  const reach = TREE_TRUNK_RADIUS + radius + RECURVE_GATE_GAP
  return [
    { x: treeX + sideX * reach, z: treeZ + sideZ * reach },
    { x: treeX - sideX * reach, z: treeZ - sideZ * reach },
  ]
}

function buildFillet(
  spawnX: number,
  spawnZ: number,
  gateX: number,
  gateZ: number,
  aimX: number,
  aimZ: number,
  arrowRadius: number,
): { t1x: number; t1z: number; t2x: number; t2z: number; curve: FlightCurve } | null {
  let d1x = gateX - spawnX
  let d1z = gateZ - spawnZ
  const leg1 = Math.hypot(d1x, d1z)
  if (leg1 < 1e-4) return null
  d1x /= leg1
  d1z /= leg1
  let d2x = aimX - gateX
  let d2z = aimZ - gateZ
  const leg2 = Math.hypot(d2x, d2z)
  if (leg2 < 1e-4) return null
  d2x /= leg2
  d2z /= leg2
  const theta = Math.acos(clampUnit(-(d1x * d2x + d1z * d2z)))
  if (theta > Math.PI - 0.08 || theta < 0.08) return null
  const half = theta / 2
  const tanHalf = Math.tan(half)
  const sinHalf = Math.sin(half)
  if (tanHalf < 1e-4 || sinHalf < 1e-4) return null
  const maxRadius = Math.min(leg1, leg2) * 0.92 * tanHalf
  if (maxRadius < RECURVE_CURVE_MIN_RADIUS) return null
  let radius = Math.min(RECURVE_CURVE_RADIUS, maxRadius)
  const bisectorX = -d1x + d2x
  const bisectorZ = -d1z + d2z
  const bisector = Math.hypot(bisectorX, bisectorZ)
  if (bisector < 1e-6) return null

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const setback = radius / tanHalf
    const t1x = gateX - d1x * setback
    const t1z = gateZ - d1z * setback
    const t2x = gateX + d2x * setback
    const t2z = gateZ + d2z * setback
    const cx = gateX + (bisectorX / bisector) * (radius / sinHalf)
    const cz = gateZ + (bisectorZ / bisector) * (radius / sinHalf)
    const entry = Math.atan2(t1z - cz, t1x - cx)
    let sweep = Math.atan2(t2z - cz, t2x - cx) - entry
    while (sweep > Math.PI) sweep -= Math.PI * 2
    while (sweep < -Math.PI) sweep += Math.PI * 2
    if (!arcBlocked(cx, cz, radius, entry, sweep, arrowRadius)) {
      return { t1x, t1z, t2x, t2z, curve: { cx, cz, radius, sweep, entry } }
    }
    radius *= 0.65
    if (radius < RECURVE_CURVE_MIN_RADIUS) return null
  }
  return null
}

function arcBlocked(
  cx: number,
  cz: number,
  radius: number,
  entry: number,
  sweep: number,
  arrowRadius: number,
): boolean {
  const steps = 8
  let prevX = cx + Math.cos(entry) * radius
  let prevZ = cz + Math.sin(entry) * radius
  for (let step = 1; step <= steps; step += 1) {
    const angle = entry + (sweep * step) / steps
    const x = cx + Math.cos(angle) * radius
    const z = cz + Math.sin(angle) * radius
    if (coverHit(prevX, prevZ, x, z, arrowRadius)) return true
    prevX = x
    prevZ = z
  }
  return false
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(-1, value))
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
