import { MAX_HP, PLAYER_SPEED, SPAWN_POINTS, type InputMessage } from '@bounty/shared'
import { clampSpeed, wishVelocity, wrapAngle } from './physics'
import type { Weapon } from './Weapon'

const IDLE_INPUT: InputMessage = {
  type: 'input',
  up: false,
  down: false,
  left: false,
  right: false,
  aim: 0,
  shoot: false,
}

export class Player {
  x: number
  z: number
  aim = 0
  hp = MAX_HP
  alive = true
  respawnAtMs: number | null = null
  lastShotMs = Number.NEGATIVE_INFINITY
  input: InputMessage = IDLE_INPUT
  weapon: Weapon | null = null

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
