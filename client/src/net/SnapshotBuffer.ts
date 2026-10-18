import {
  TELEPORT_SNAP_DISTANCE,
  type ArrowStackSnapshot,
  type DummySnapshot,
  type ExplosionSnapshot,
  type PlayerSnapshot,
  type ProjectileSnapshot,
  type StateMessage,
  type WeaponSnapshot,
} from '@bounty/shared'

export interface RenderSample {
  players: PlayerSnapshot[]
  projectiles: ProjectileSnapshot[]
  weapons: WeaponSnapshot[]
  stacks: ArrowStackSnapshot[]
  dummies: DummySnapshot[]
  explosions: ExplosionSnapshot[]
}

interface TimedSnapshot {
  receivedAt: number
  state: StateMessage
}

export class SnapshotBuffer {
  private previous: TimedSnapshot | null = null
  private latest: TimedSnapshot | null = null

  push(state: StateMessage, receivedAt: number): void {
    if (this.latest) this.previous = this.latest
    this.latest = { state, receivedAt }
  }

  sample(now: number): RenderSample | null {
    const latest = this.latest
    if (!latest) return null
    const previous = this.previous
    if (!previous) {
      return {
        players: latest.state.players,
        projectiles: latest.state.projectiles,
        weapons: latest.state.weapons,
        stacks: latest.state.stacks,
        dummies: latest.state.dummies,
        explosions: latest.state.explosions,
      }
    }

    const span = latest.receivedAt - previous.receivedAt
    const alpha = span > 0 ? clamp01((now - latest.receivedAt) / span) : 1
    return blend(previous.state, latest.state, alpha)
  }
}

function blend(before: StateMessage, after: StateMessage, alpha: number): RenderSample {
  const previousPlayers = new Map(before.players.map((player) => [player.id, player]))
  const players = after.players.map((player) => {
    const prior = previousPlayers.get(player.id)
    if (!prior || prior.alive !== player.alive) return player
    const dx = player.x - prior.x
    const dz = player.z - prior.z
    if (dx * dx + dz * dz > TELEPORT_SNAP_DISTANCE * TELEPORT_SNAP_DISTANCE) return player
    return {
      ...player,
      x: prior.x + dx * alpha,
      z: prior.z + dz * alpha,
      aim: lerpAngle(prior.aim, player.aim, alpha),
    }
  })

  const previousProjectiles = new Map(
    before.projectiles.map((projectile) => [projectile.id, projectile]),
  )
  const projectiles = after.projectiles.map((projectile) => {
    const prior = previousProjectiles.get(projectile.id)
    if (!prior) return projectile
    const turned = prior.dirX * projectile.dirX + prior.dirZ * projectile.dirZ < 0.35
    if (turned) return projectile
    return {
      ...projectile,
      x: prior.x + (projectile.x - prior.x) * alpha,
      z: prior.z + (projectile.z - prior.z) * alpha,
    }
  })

  const previousWeapons = new Map(before.weapons.map((weapon) => [weapon.id, weapon]))
  const weapons = after.weapons.map((weapon) => {
    const prior = previousWeapons.get(weapon.id)
    if (!prior || prior.heldBy !== weapon.heldBy) return weapon
    return {
      ...weapon,
      x: prior.x + (weapon.x - prior.x) * alpha,
      z: prior.z + (weapon.z - prior.z) * alpha,
    }
  })

  return {
    players,
    projectiles,
    weapons,
    stacks: after.stacks,
    dummies: after.dummies,
    explosions: after.explosions,
  }
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function lerpAngle(a: number, b: number, t: number): number {
  const difference = Math.atan2(Math.sin(b - a), Math.cos(b - a))
  return a + difference * t
}
