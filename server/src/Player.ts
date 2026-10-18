import {
  ARROW_KINDS,
  MAX_HP,
  PLAYER_SPEED,
  SPAWN_POINTS,
  type ArrowKind,
  type InputMessage,
  type QuiverCounts,
  type ShotArrow,
} from '@bounty/shared'
import { clampSpeed, wishVelocity, wrapAngle } from './physics'
import type { Weapon } from './Weapon'

const IDLE_INPUT: InputMessage = {
  type: 'input',
  up: false,
  down: false,
  left: false,
  right: false,
  aim: 0,
  aimX: 0,
  aimZ: 0,
  shoot: false,
  slot: 0,
}

export class Player {
  x: number
  z: number
  aim = 0
  hp = MAX_HP
  alive = true
  respawnAtMs: number | null = null
  lastShotMs = Number.NEGATIVE_INFINITY
  /** World time until a bush no longer hides this hunter. */
  exposedUntilMs = 0
  input: InputMessage = IDLE_INPUT
  weapon: Weapon | null = null
  /** Ricochet, explosion, bodkin, and flare, matching the 1, 2, 3, and 4 keys. */
  readonly quiver: QuiverCounts = [0, 0, 0, 0]
  selected: ShotArrow = 'normal'

  constructor(
    readonly id: string,
    readonly username: string,
    readonly spawnIndex: number,
    readonly color: number,
  ) {
    const spawn = SPAWN_POINTS[spawnIndex]
    if (!spawn) throw new Error(`Missing spawn point ${spawnIndex}`)
    this.x = spawn.x
    this.z = spawn.z
  }

  setInput(input: InputMessage): void {
    this.input = input
    this.selectSlot(input.slot)
  }

  addArrows(kind: ArrowKind, count: number): void {
    const index = ARROW_KINDS.indexOf(kind)
    const held = this.quiver[index]
    if (held === undefined) return
    this.quiver[index] = held + count
  }

  /** Spends one special arrow when one is selected and still in the quiver. */
  consumeArrow(): ShotArrow {
    if (this.selected === 'normal') return 'normal'
    const index = ARROW_KINDS.indexOf(this.selected)
    const held = this.quiver[index]
    if (held === undefined || held <= 0) {
      this.selected = 'normal'
      return 'normal'
    }
    const used = this.selected
    this.quiver[index] = held - 1
    if (held === 1) this.selected = 'normal'
    return used
  }

  private selectSlot(slot: number): void {
    if (slot === 0) {
      this.selected = 'normal'
      return
    }
    const index = slot - 1
    const kind = ARROW_KINDS[index]
    const held = this.quiver[index]
    if (!kind || held === undefined || held <= 0) return
    this.selected = kind
  }

  hold(weapon: Weapon): void {
    this.weapon = weapon
    weapon.holderId = this.id
    weapon.x = this.x
    weapon.z = this.z
  }

  releaseWeapon(): Weapon | null {
    const weapon = this.weapon
    if (!weapon) return null
    weapon.holderId = null
    weapon.x = this.x
    weapon.z = this.z
    this.weapon = null
    return weapon
  }

  advance(dt: number): void {
    if (!this.alive) return

    this.aim = wrapAngle(this.input.aim)
    const velocity = clampSpeed(wishVelocity(this.input), PLAYER_SPEED)
    this.x += velocity.x * dt
    this.z += velocity.z * dt
  }
}
