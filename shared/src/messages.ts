import { isArrowKind, isShotArrow, type ArrowKind, type QuiverCounts, type ShotArrow } from './arrow'
import { PLAYER_COLORS, PLAYER_ID_MAX_LENGTH, USERNAME_MAX_LENGTH } from './constants'
import { isWeaponKind, type WeaponKind } from './weapon'

export interface JoinMessage {
  type: 'join'
  username: string
}

export interface InputMessage {
  type: 'input'
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  aim: number
  /** Ground point under the cursor. Lobs and hooks land here. */
  aimX: number
  aimZ: number
  shoot: boolean
  /** 0 is the bow. 1, 2, 3, and 4 are the picked-up arrow slots. */
  slot: number
}

export type WeaponAction = 'drop' | 'pickup'

export interface ActionMessage {
  type: 'action'
  action: WeaponAction
  /** Set when picking up one bow. Drop leaves this empty. */
  weaponId: string | null
}

export type ClientMessage = JoinMessage | InputMessage | ActionMessage

export interface WelcomeMessage {
  type: 'welcome'
  playerId: string
}

export interface ArenaFullMessage {
  type: 'arena_full'
}

export interface PlayerSnapshot {
  id: string
  username: string
  x: number
  z: number
  aim: number
  hp: number
  alive: boolean
  color: number
  weaponId: string | null
  /** True when this hunter is concealed in a bush. Others are omitted instead. */
  hidden: boolean
  /** `normal` is unlimited. The other values spend a slot in `quiver`. */
  selected: ShotArrow
  /** Counts for ricochet, explosion, bodkin, and flare, in that order. */
  quiver: QuiverCounts
  /** Milliseconds until this hunter's bow can loose again. */
  cooldownMs: number
}

export interface ProjectileSnapshot {
  id: string
  ownerId: string
  x: number
  y: number
  z: number
  dirX: number
  dirY: number
  dirZ: number
  arrow: ShotArrow
}

export interface ArrowStackSnapshot {
  id: string
  kind: ArrowKind
  x: number
  z: number
  count: number
}

export interface DummySnapshot {
  id: string
  x: number
  z: number
  hp: number
  alive: boolean
}

export interface ExplosionSnapshot {
  id: string
  ownerId: string
  x: number
  z: number
  radius: number
  ageMs: number
}

export interface WeaponSnapshot {
  id: string
  kind: WeaponKind
  x: number
  z: number
  heldBy: string | null
}

export interface StateMessage {
  type: 'state'
  tick: number
  players: PlayerSnapshot[]
  projectiles: ProjectileSnapshot[]
  weapons: WeaponSnapshot[]
  stacks: ArrowStackSnapshot[]
  dummies: DummySnapshot[]
  explosions: ExplosionSnapshot[]
}

export type ServerMessage = WelcomeMessage | ArenaFullMessage | StateMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isShortId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= PLAYER_ID_MAX_LENGTH
}

export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!isRecord(value)) return null

  if (value.type === 'join') {
    if (typeof value.username !== 'string') return null
    return { type: 'join', username: value.username }
  }

  if (value.type === 'input') {
    if (
      !isBoolean(value.up) ||
      !isBoolean(value.down) ||
      !isBoolean(value.left) ||
      !isBoolean(value.right) ||
      !isBoolean(value.shoot) ||
      !isFiniteNumber(value.aim) ||
      !isFiniteNumber(value.aimX) ||
      !isFiniteNumber(value.aimZ) ||
      !isSlot(value.slot)
    ) {
      return null
    }
    return {
      type: 'input',
      up: value.up,
      down: value.down,
      left: value.left,
      right: value.right,
      aim: value.aim,
      aimX: value.aimX,
      aimZ: value.aimZ,
      shoot: value.shoot,
      slot: value.slot,
    }
  }

  if (value.type === 'action') {
    if (value.action === 'drop') return { type: 'action', action: 'drop', weaponId: null }
    if (value.action !== 'pickup' || !isShortId(value.weaponId)) return null
    return { type: 'action', action: 'pickup', weaponId: value.weaponId }
  }

  return null
}

function parsePlayer(value: unknown): PlayerSnapshot | null {
  if (!isRecord(value)) return null
  if (!isShortId(value.id)) return null
  if (typeof value.username !== 'string' || value.username.length > USERNAME_MAX_LENGTH) return null
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.z) || !isFiniteNumber(value.aim))
    return null
  if (!isFiniteNumber(value.hp) || typeof value.alive !== 'boolean' || typeof value.hidden !== 'boolean')
    return null
  if (!isFiniteNumber(value.color) || !Number.isInteger(value.color)) return null
  if (value.color < 0 || value.color >= PLAYER_COLORS.length) return null
  const weaponId = parseNullableId(value.weaponId)
  if (weaponId === undefined) return null
  if (!isShotArrow(value.selected)) return null
  const quiver = parseQuiver(value.quiver)
  if (!quiver) return null
  if (!isFiniteNumber(value.cooldownMs) || value.cooldownMs < 0) return null

  return {
    id: value.id,
    username: value.username,
    x: value.x,
    z: value.z,
    aim: value.aim,
    hp: value.hp,
    alive: value.alive,
    color: value.color,
    weaponId,
    hidden: value.hidden,
    selected: value.selected,
    quiver,
    cooldownMs: value.cooldownMs,
  }
}

function parseProjectile(value: unknown): ProjectileSnapshot | null {
  if (!isRecord(value)) return null
  if (!isShortId(value.id) || !isShortId(value.ownerId)) return null
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y) || !isFiniteNumber(value.z)) return null
  if (!isFiniteNumber(value.dirX) || !isFiniteNumber(value.dirY) || !isFiniteNumber(value.dirZ)) return null
  if (!isShotArrow(value.arrow)) return null
  return {
    id: value.id,
    ownerId: value.ownerId,
    x: value.x,
    y: value.y,
    z: value.z,
    dirX: value.dirX,
    dirY: value.dirY,
    dirZ: value.dirZ,
    arrow: value.arrow,
  }
}

function parseStack(value: unknown): ArrowStackSnapshot | null {
  if (!isRecord(value)) return null
  if (!isShortId(value.id) || !isArrowKind(value.kind)) return null
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.z)) return null
  if (!isFiniteNumber(value.count) || !Number.isInteger(value.count) || value.count <= 0) return null
  return { id: value.id, kind: value.kind, x: value.x, z: value.z, count: value.count }
}

function parseDummy(value: unknown): DummySnapshot | null {
  if (!isRecord(value)) return null
  if (!isShortId(value.id)) return null
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.z)) return null
  if (!isFiniteNumber(value.hp) || value.hp < 0 || typeof value.alive !== 'boolean') return null
  return { id: value.id, x: value.x, z: value.z, hp: value.hp, alive: value.alive }
}

function parseExplosion(value: unknown): ExplosionSnapshot | null {
  if (!isRecord(value)) return null
  if (!isShortId(value.id) || !isShortId(value.ownerId)) return null
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.z)) return null
  if (!isFiniteNumber(value.radius) || value.radius <= 0) return null
  if (!isFiniteNumber(value.ageMs) || value.ageMs < 0) return null
  return {
    id: value.id,
    ownerId: value.ownerId,
    x: value.x,
    z: value.z,
    radius: value.radius,
    ageMs: value.ageMs,
  }
}

function parseWeapon(value: unknown): WeaponSnapshot | null {
  if (!isRecord(value)) return null
  if (!isShortId(value.id) || !isWeaponKind(value.kind)) return null
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.z)) return null
  const heldBy = parseNullableId(value.heldBy)
  if (heldBy === undefined) return null
  return { id: value.id, kind: value.kind, x: value.x, z: value.z, heldBy }
}

function isSlot(value: unknown): value is 0 | 1 | 2 | 3 | 4 {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4
}

function parseQuiver(value: unknown): QuiverCounts | null {
  if (!Array.isArray(value) || value.length !== 4) return null
  const counts: number[] = []
  for (const entry of value) {
    if (!isFiniteNumber(entry) || !Number.isInteger(entry) || entry < 0) return null
    counts.push(entry)
  }
  const ricochet = counts[0]
  const explosion = counts[1]
  const bodkin = counts[2]
  const flare = counts[3]
  if (
    ricochet === undefined ||
    explosion === undefined ||
    bodkin === undefined ||
    flare === undefined
  ) {
    return null
  }
  return [ricochet, explosion, bodkin, flare]
}

function parseNullableId(value: unknown): string | null | undefined {
  if (value === null) return null
  if (isShortId(value)) return value
  return undefined
}

export function parseServerMessage(value: unknown): ServerMessage | null {
  if (!isRecord(value)) return null

  if (value.type === 'welcome') {
    if (!isShortId(value.playerId)) return null
    return { type: 'welcome', playerId: value.playerId }
  }

  if (value.type === 'arena_full') {
    return { type: 'arena_full' }
  }

  if (value.type === 'state') {
    if (
      !isFiniteNumber(value.tick) ||
      !Array.isArray(value.players) ||
      !Array.isArray(value.projectiles) ||
      !Array.isArray(value.weapons) ||
      !Array.isArray(value.stacks) ||
      !Array.isArray(value.dummies) ||
      !Array.isArray(value.explosions)
    ) {
      return null
    }
    const players: PlayerSnapshot[] = []
    for (const entry of value.players) {
      const player = parsePlayer(entry)
      if (!player) return null
      players.push(player)
    }
    const projectiles: ProjectileSnapshot[] = []
    for (const entry of value.projectiles) {
      const projectile = parseProjectile(entry)
      if (!projectile) return null
      projectiles.push(projectile)
    }
    const weapons: WeaponSnapshot[] = []
    for (const entry of value.weapons) {
      const weapon = parseWeapon(entry)
      if (!weapon) return null
      weapons.push(weapon)
    }
    const stacks: ArrowStackSnapshot[] = []
    for (const entry of value.stacks) {
      const stack = parseStack(entry)
      if (!stack) return null
      stacks.push(stack)
    }
    const dummies: DummySnapshot[] = []
    for (const entry of value.dummies) {
      const dummy = parseDummy(entry)
      if (!dummy) return null
      dummies.push(dummy)
    }
    const explosions: ExplosionSnapshot[] = []
    for (const entry of value.explosions) {
      const explosion = parseExplosion(entry)
      if (!explosion) return null
      explosions.push(explosion)
    }
    return { type: 'state', tick: value.tick, players, projectiles, weapons, stacks, dummies, explosions }
  }

  return null
}
