import {
  MAX_HP,
  MAX_PLAYERS,
  PICKUP_RADIUS,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  RESPAWN_DELAY_MS,
  SPAWN_POINTS,
  TICK_MS,
  TICK_SECONDS,
  isInSight,
  type InputMessage,
  type StateMessage,
  type WeaponAction,
  type WeaponKind,
  type WeaponSnapshot,
} from '@bounty/shared'
import { Player } from './Player'
import type { Projectile } from './Projectile'
import { Weapon } from './Weapon'
import { clampToArena, coverBlockT, isInsideArena, resolveCover, segmentHitT, separateCircles } from './physics'

export class Game {
  private readonly players = new Map<string, Player>()
  private projectiles: Projectile[] = []
  private groundWeapons: Weapon[] = []
  private tickCount = 0
  private elapsedMs = 0

  constructor() {
    if (SPAWN_POINTS.length < MAX_PLAYERS) {
      throw new Error('Not enough spawn points for MAX_PLAYERS')
    }
    if (PLAYER_COLORS.length < MAX_PLAYERS) {
      throw new Error('Not enough player colors for MAX_PLAYERS')
    }
    this.scatterBows()
  }

  get playerCount(): number {
    return this.players.size
  }

  addPlayer(id: string, username: string): boolean {
    if (this.players.has(id) || this.players.size >= MAX_PLAYERS) return false

    const spawnIndex = this.firstFreeSpawn()
    if (spawnIndex === null) return false

    const player = new Player(id, username, spawnIndex, spawnIndex)
    this.players.set(id, player)
    return true
  }

  removePlayer(id: string): void {
    const player = this.players.get(id)
    if (!player) return
    const dropped = player.releaseWeapon()
    if (dropped) this.groundWeapons.push(dropped)
    this.players.delete(id)
    this.projectiles = this.projectiles.filter((projectile) => projectile.ownerId !== id)
  }

  setInput(id: string, input: InputMessage): void {
    this.players.get(id)?.setInput(input)
  }

  applyAction(id: string, action: WeaponAction): void {
    const player = this.players.get(id)
    if (!player) return
    if (action === 'drop') this.dropWeapon(player)
    else this.pickupWeapon(player)
  }

  tick(): void {
    this.tickCount += 1
    this.elapsedMs += TICK_MS
    this.respawnPlayers()

    for (const player of this.players.values()) {
      player.advance(TICK_SECONDS)
      this.settle(player)
    }

    this.separatePlayers()
    for (const player of this.players.values()) this.settle(player)

    for (const player of this.players.values()) {
      this.tryShoot(player)
    }

    this.advanceProjectiles()
  }

  snapshot(): StateMessage {
    return {
      type: 'state',
      tick: this.tickCount,
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        username: player.username,
        x: player.x,
        z: player.z,
        aim: player.aim,
        hp: player.hp,
        alive: player.alive,
        color: player.color,
        weaponId: player.weapon?.id ?? null,
      })),
      projectiles: this.projectiles.map((projectile) => ({
        id: projectile.id,
        ownerId: projectile.ownerId,
        x: projectile.x,
        z: projectile.z,
        dirX: projectile.dirX,
        dirZ: projectile.dirZ,
      })),
      weapons: this.weaponSnapshots(),
    }
  }

  snapshotFor(viewerId: string): StateMessage {
    const state = this.snapshot()
    const viewer = this.players.get(viewerId)
    if (!viewer) return { ...state, players: [], projectiles: [], weapons: [] }

    return {
      ...state,
      players: state.players.filter(
        (player) => player.id === viewerId || this.inSight(viewer, player.x, player.z, 0.4),
      ),
      projectiles: state.projectiles.filter((projectile) =>
        this.inSight(viewer, projectile.x, projectile.z, 0.15),
      ),
      weapons: state.weapons.filter((weapon) => this.inSight(viewer, weapon.x, weapon.z, 0.3)),
    }
  }

  private firstFreeSpawn(): number | null {
    for (let index = 0; index < SPAWN_POINTS.length; index += 1) {
      let taken = false
      for (const player of this.players.values()) {
        if (player.spawnIndex === index) taken = true
      }
      if (!taken) return index
    }
    return null
  }

  private separatePlayers(): void {
    const alive = [...this.players.values()].filter((player) => player.alive)
    for (let i = 0; i < alive.length; i += 1) {
      const a = alive[i]
      if (!a) continue
      for (let j = i + 1; j < alive.length; j += 1) {
        const b = alive[j]
        if (!b) continue
        const separated = separateCircles(a.x, a.z, b.x, b.z, PLAYER_RADIUS)
        if (!separated) continue
        const clampedA = clampToArena(separated.ax, separated.az, PLAYER_RADIUS)
        const clampedB = clampToArena(separated.bx, separated.bz, PLAYER_RADIUS)
        a.x = clampedA.x
        a.z = clampedA.z
        b.x = clampedB.x
        b.z = clampedB.z
      }
    }
  }

  private inSight(viewer: Player, x: number, z: number, margin: number): boolean {
    return isInSight(viewer.x, viewer.z, viewer.aim, x, z, margin)
  }

  private scatterBows(): void {
    let index = 0
    for (const x of scatterLine()) {
      for (const z of scatterLine()) {
        const kind: WeaponKind = index % 2 === 0 ? 'longbow' : 'shortbow'
        this.groundWeapons.push(new Weapon(kind, x, z))
        index += 1
      }
    }
    const near: readonly [number, number, WeaponKind][] = [
      [-11.5, -13.2, 'longbow'],
      [-13.2, -11.2, 'shortbow'],
      [-10.5, -12.5, 'shortbow'],
      [-12.2, -10.2, 'longbow'],
      [11.5, 13.2, 'shortbow'],
      [13.2, 11.2, 'longbow'],
      [10.5, 12.5, 'longbow'],
      [12.2, 10.2, 'shortbow'],
    ]
    for (const [x, z, kind] of near) this.groundWeapons.push(new Weapon(kind, x, z))
  }

  private dropWeapon(player: Player): void {
    if (!player.alive) return
    const weapon = player.releaseWeapon()
    if (weapon) this.groundWeapons.push(weapon)
  }

  private pickupWeapon(player: Player): void {
    if (!player.alive || player.weapon) return

    let nearest: Weapon | null = null
    let nearestDistance = PICKUP_RADIUS
    for (const weapon of this.groundWeapons) {
      const distance = Math.hypot(weapon.x - player.x, weapon.z - player.z)
      if (distance > nearestDistance) continue
      nearest = weapon
      nearestDistance = distance
    }
    if (!nearest) return

    const chosen = nearest
    this.groundWeapons = this.groundWeapons.filter((weapon) => weapon !== chosen)
    player.hold(chosen)
  }

  private weaponSnapshots(): WeaponSnapshot[] {
    const snapshots: WeaponSnapshot[] = []
    for (const weapon of this.groundWeapons) {
      snapshots.push({
        id: weapon.id,
        kind: weapon.kind,
        x: weapon.x,
        z: weapon.z,
        heldBy: null,
      })
    }
    for (const player of this.players.values()) {
      const weapon = player.weapon
      if (!weapon) continue
      snapshots.push({
        id: weapon.id,
        kind: weapon.kind,
        x: player.x,
        z: player.z,
        heldBy: player.id,
      })
    }
    return snapshots
  }

  private tryShoot(player: Player): void {
    const weapon = player.weapon
    if (!player.alive || !player.input.shoot || !weapon) return
    if (this.elapsedMs - player.lastShotMs < weapon.spec.fireCooldownMs) return

    player.lastShotMs = this.elapsedMs
    this.projectiles.push(weapon.spawnProjectile(player.id, player.x, player.z, player.aim))
  }

  private advanceProjectiles(): void {
    const remaining: Projectile[] = []

    for (const projectile of this.projectiles) {
      const rangeLeft = projectile.spec.maxRange - projectile.traveled
      if (rangeLeft <= 0) continue

      const step = Math.min(projectile.spec.speed * TICK_SECONDS, rangeLeft)
      const segment = projectile.advance(step)
      const hitRadius = PLAYER_RADIUS + projectile.spec.radius
      const hit = this.findHit(
        projectile.ownerId,
        segment.x0,
        segment.z0,
        segment.x1,
        segment.z1,
        hitRadius,
      )
      const coverT = projectile.spec.penetrates
        ? null
        : coverBlockT(segment.x0, segment.z0, segment.x1, segment.z1, projectile.spec.radius)
      if (coverT !== null && (hit === null || coverT <= hit.t)) {
        if (projectile.spec.explodes) {
          const x = segment.x0 + (segment.x1 - segment.x0) * coverT
          const z = segment.z0 + (segment.z1 - segment.z0) * coverT
          this.explode(projectile, x, z)
        }
        continue
      }
      if (hit) {
        if (projectile.spec.explodes) this.explode(projectile, hit.player.x, hit.player.z)
        else this.applyDamage(hit.player, projectile.spec.damage)
        continue
      }

      const blockedByWall =
        !projectile.spec.penetrates &&
        !isInsideArena(projectile.x, projectile.z, projectile.spec.radius)
      const outOfRange = projectile.traveled >= projectile.spec.maxRange
      if (blockedByWall || outOfRange) {
        if (projectile.spec.explodes) this.explode(projectile, projectile.x, projectile.z)
        continue
      }
      remaining.push(projectile)
    }

    this.projectiles = remaining
  }

  private settle(player: Player): void {
    const covered = resolveCover(player.x, player.z, PLAYER_RADIUS)
    const clamped = clampToArena(covered.x, covered.z, PLAYER_RADIUS)
    player.x = clamped.x
    player.z = clamped.z
  }

  private findHit(
    ownerId: string,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    radius: number,
  ): { player: Player; t: number } | null {
    let closest: Player | null = null
    let closestT = Number.POSITIVE_INFINITY

    for (const player of this.players.values()) {
      if (!player.alive || player.id === ownerId) continue
      const t = segmentHitT(x0, z0, x1, z1, player.x, player.z, radius)
      if (t === null || t >= closestT) continue
      closestT = t
      closest = player
    }

    if (!closest) return null
    return { player: closest, t: closestT }
  }

  private explode(projectile: Projectile, x: number, z: number): void {
    const radius = projectile.spec.explosionRadius + PLAYER_RADIUS
    const radiusSquared = radius * radius
    for (const player of this.players.values()) {
      if (!player.alive || player.id === projectile.ownerId) continue
      const dx = player.x - x
      const dz = player.z - z
      if (dx * dx + dz * dz > radiusSquared) continue
      this.applyDamage(player, projectile.spec.damage)
    }
  }

  private applyDamage(player: Player, damage: number): void {
    if (!player.alive) return
    player.hp = Math.max(0, player.hp - damage)
    if (player.hp > 0) return
    player.alive = false
    player.respawnAtMs = this.elapsedMs + RESPAWN_DELAY_MS
  }

  private respawnPlayers(): void {
    for (const player of this.players.values()) {
      if (player.alive || player.respawnAtMs === null) continue
      if (this.elapsedMs < player.respawnAtMs) continue

      const spawn = SPAWN_POINTS[player.spawnIndex]
      if (!spawn) continue
      player.x = spawn.x
      player.z = spawn.z
      player.hp = MAX_HP
      player.alive = true
      player.respawnAtMs = null
    }
  }
}

function scatterLine(): readonly number[] {
  return [-12, -6, 0, 6, 12]
}
