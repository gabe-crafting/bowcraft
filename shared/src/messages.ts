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
  shoot: boolean
}

export type WeaponAction = 'drop' | 'pickup'

export interface ActionMessage {
  type: 'action'
  action: WeaponAction
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
}

export interface ProjectileSnapshot {
  id: string
  ownerId: string
  x: number
  z: number
  dirX: number
  dirZ: number
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
      !isFiniteNumber(value.aim)
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
      shoot: value.shoot,
    }
  }

  if (value.type === 'action') {
    if (value.action !== 'drop' && value.action !== 'pickup') return null
    return { type: 'action', action: value.action }
  }

  return null
}

function parsePlayer(value: unknown): PlayerSnapshot | null {
  if (!isRecord(value)) return null
  if (!isShortId(value.id)) return null
  if (typeof value.username !== 'string' || value.username.length > USERNAME_MAX_LENGTH) return null
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.z) || !isFiniteNumber(value.aim))
    return null
  if (!isFiniteNumber(value.hp) || typeof value.alive !== 'boolean') return null
  if (!isFiniteNumber(value.color) || !Number.isInteger(value.color)) return null
  if (value.color < 0 || value.color >= PLAYER_COLORS.length) return null
  const weaponId = parseNullableId(value.weaponId)
  if (weaponId === undefined) return null

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
  }
}

function parseProjectile(value: unknown): ProjectileSnapshot | null {
  if (!isRecord(value)) return null
  if (!isShortId(value.id) || !isShortId(value.ownerId)) return null
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.z)) return null
  if (!isFiniteNumber(value.dirX) || !isFiniteNumber(value.dirZ)) return null
  return {
    id: value.id,
    ownerId: value.ownerId,
    x: value.x,
    z: value.z,
    dirX: value.dirX,
    dirZ: value.dirZ,
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
      !Array.isArray(value.weapons)
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
    return { type: 'state', tick: value.tick, players, projectiles, weapons }
  }

  return null
}
