import {
  ARROW_GRAVITY,
  timeToGround,
  ARROW_KINDS,
  ARROW_REST_MS,
  ARROW_STACK_SIZE,
  COVER_PASS_HEIGHT,
  HUNTER_HIT_HEIGHT,
  arrowShot,
  BUSH_REVEAL_MS,
  DUMMY_RADIUS,
  EXPLOSION_ANIM_MS,
  FLARE_LIGHT_FALLOFF,
  FLARE_LIGHT_RADIUS,
  isInBush,
  isInLight,
  isInSight,
  MAX_HP,
  MAX_PLAYERS,
  PICKUP_RADIUS,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  RESPAWN_DELAY_MS,
  SPAWN_POINTS,
  TICK_MS,
  TICK_SECONDS,
  TREES,
  TREE_TRUNK_RADIUS,
  WALLS,
  wallBounds,
  type ArrowKind,
  type ArrowStackSnapshot,
  type DummySnapshot,
  type ExplosionSnapshot,
  type ActionMessage,
  type InputMessage,
  type StateMessage,
  type WeaponKind,
  type WeaponSnapshot,
} from '@bounty/shared'
import { ArrowStack } from './ArrowStack'
import { Dummy } from './Dummy'
import { Explosion } from './Explosion'
import { Player } from './Player'
import type { Projectile } from './Projectile'
import { Weapon } from './Weapon'
import {
  arenaBorderHit,
  arenaLimit,
  clampToArena,
  coverHit,
  resolveCover,
  segmentHitT,
  separateCircles,
} from './physics'

export class Game {
  private readonly players = new Map<string, Player>()
  private projectiles: Projectile[] = []
  private groundWeapons: Weapon[] = []
  private arrowStacks: ArrowStack[] = []
  private dummies: Dummy[] = []
  private explosions: Explosion[] = []
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
    this.scatterArrows()
    this.scatterDummies()
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

  applyAction(id: string, action: ActionMessage): void {
    const player = this.players.get(id)
    if (!player) return
    if (action.action === 'drop') this.dropWeapon(player)
    else if (action.weaponId) this.pickupWeapon(player, action.weaponId)
  }

  tick(): void {
    this.tickCount += 1
    this.elapsedMs += TICK_MS
    this.decayExplosions()
    this.respawnPlayers()

    for (const player of this.players.values()) {
      player.advance(TICK_SECONDS)
      this.settle(player)
    }

    this.separatePlayers()
    for (const player of this.players.values()) this.settle(player)

    this.collectArrows()
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
        hidden: this.isConcealed(player),
        selected: player.selected,
        quiver: [
          player.quiver[0] ?? 0,
          player.quiver[1] ?? 0,
          player.quiver[2] ?? 0,
          player.quiver[3] ?? 0,
        ],
        cooldownMs: this.cooldownMs(player),
      })),
      projectiles: this.projectiles.map((projectile) => {
        const heading = projectile.heading()
        return {
          id: projectile.id,
          ownerId: projectile.ownerId,
          x: projectile.x,
          y: projectile.y,
          z: projectile.z,
          dirX: heading.dirX,
          dirY: heading.dirY,
          dirZ: heading.dirZ,
          arrow: projectile.arrow,
        }
      }),
      weapons: this.weaponSnapshots(),
      stacks: this.stackSnapshots(),
      dummies: this.dummySnapshots(),
      explosions: this.explosionSnapshots(),
    }
  }

  snapshotFor(viewerId: string): StateMessage {
    const state = this.snapshot()
    const viewer = this.players.get(viewerId)
    if (!viewer) {
      return { ...state, players: [], projectiles: [], weapons: [], stacks: [], dummies: [], explosions: [] }
    }

    return {
      ...state,
      players: state.players.filter(
        (player) =>
          player.id === viewerId ||
          (!player.hidden && this.seen(viewer, player.x, player.z, 0.4)),
      ),
      projectiles: state.projectiles.filter(
        (projectile) =>
          projectile.ownerId === viewerId || this.seen(viewer, projectile.x, projectile.z, 0.15),
      ),
      weapons: state.weapons.filter((weapon) => this.seen(viewer, weapon.x, weapon.z, 0.3)),
      stacks: state.stacks.filter((stack) => this.seen(viewer, stack.x, stack.z, 0.3)),
      dummies: state.dummies.filter((dummy) => this.seen(viewer, dummy.x, dummy.z, 0.35)),
      explosions: state.explosions.filter(
        (blast) => blast.ownerId === viewerId || this.seen(viewer, blast.x, blast.z, blast.radius),
      ),
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

  private isConcealed(player: Player): boolean {
    if (!player.alive) return false
    if (this.elapsedMs < player.exposedUntilMs) return false
    return isInBush(player.x, player.z)
  }

  private inSight(viewer: Player, x: number, z: number, margin: number): boolean {
    return isInSight(viewer.x, viewer.z, viewer.aim, x, z, margin)
  }

  private seen(viewer: Player, x: number, z: number, margin: number): boolean {
    if (this.inSight(viewer, x, z, margin)) return true
    return this.projectiles.some(
      (projectile) =>
        projectile.arrow === 'flare' &&
        isInLight(
          projectile.x,
          projectile.z,
          x,
          z,
          FLARE_LIGHT_RADIUS,
          FLARE_LIGHT_FALLOFF,
          margin,
        ),
    )
  }

  private scatterBows(): void {
    let index = 0
    for (const x of scatterLine()) {
      for (const z of scatterLine()) {
        const kind: WeaponKind = index % 3 === 0 ? 'longbow' : index % 3 === 1 ? 'shortbow' : 'recurve'
        this.groundWeapons.push(new Weapon(kind, x, z))
        index += 1
      }
    }
    const near: readonly [number, number, WeaponKind][] = [
      [-11.5, -13.2, 'longbow'],
      [-13.2, -11.2, 'shortbow'],
      [-10.5, -12.5, 'shortbow'],
      [-12.2, -10.2, 'longbow'],
      [-9.4, -11.6, 'recurve'],
      [11.5, 13.2, 'shortbow'],
      [13.2, 11.2, 'longbow'],
      [10.5, 12.5, 'longbow'],
      [12.2, 10.2, 'shortbow'],
      [11.8, 15.0, 'recurve'],
    ]
    for (const [x, z, kind] of near) this.groundWeapons.push(new Weapon(kind, x, z))
  }

  private dropWeapon(player: Player): void {
    if (!player.alive) return
    const weapon = player.releaseWeapon()
    if (weapon) this.groundWeapons.push(weapon)
  }

  private pickupWeapon(player: Player, weaponId: string): void {
    if (!player.alive) return
    const chosen = this.groundWeapons.find((weapon) => weapon.id === weaponId)
    if (!chosen) return
    if (Math.hypot(chosen.x - player.x, chosen.z - player.z) > PICKUP_RADIUS) return

    this.groundWeapons = this.groundWeapons.filter((weapon) => weapon !== chosen)
    if (player.weapon) this.dropWeapon(player)
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

    const arrow = player.consumeArrow()
    player.lastShotMs = this.elapsedMs
    player.exposedUntilMs = this.elapsedMs + BUSH_REVEAL_MS
    this.projectiles.push(
      weapon.spawnProjectile(
        player.id,
        player.x,
        player.z,
        player.aim,
        player.input.aimX,
        player.input.aimZ,
        arrowShot(weapon.spec, arrow),
        arrow,
      ),
    )
  }

  private cooldownMs(player: Player): number {
    const weapon = player.weapon
    if (!weapon) return 0
    return Math.max(0, weapon.spec.fireCooldownMs - (this.elapsedMs - player.lastShotMs))
  }

  private collectArrows(): void {
    const remaining: ArrowStack[] = []
    for (const stack of this.arrowStacks) {
      const hunter = this.hunterAt(stack.x, stack.z)
      if (!hunter) {
        remaining.push(stack)
        continue
      }
      hunter.addArrows(stack.kind, stack.count)
    }
    this.arrowStacks = remaining
  }

  private hunterAt(x: number, z: number): Player | null {
    for (const player of this.players.values()) {
      if (!player.alive) continue
      const dx = player.x - x
      const dz = player.z - z
      if (dx * dx + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS) return player
    }
    return null
  }

  private stackSnapshots(): ArrowStackSnapshot[] {
    return this.arrowStacks.map((stack) => ({
      id: stack.id,
      kind: stack.kind,
      x: stack.x,
      z: stack.z,
      count: stack.count,
    }))
  }

  private scatterArrows(): void {
    const featured: readonly [number, number, ArrowKind][] = [
      [-12.4, -11.2, 'ricochet'],
      [-11.0, -12.6, 'explosion'],
      [-13.2, -9.4, 'bodkin'],
      [-10.2, -10.6, 'flare'],
      [13.0, 16.2, 'ricochet'],
      [15.2, 15.8, 'explosion'],
      [14.4, 16.8, 'bodkin'],
      [12.2, 15.4, 'flare'],
    ]
    for (const [x, z, kind] of featured) this.placeStack(kind, x, z)
    let index = 0
    for (let x = -14; x <= 14; x += 4) {
      for (let z = -14; z <= 14; z += 4) {
        const kind = ARROW_KINDS[index % ARROW_KINDS.length]
        if (!kind || this.arrowBlocked(x, z) || this.stackNear(x, z) || this.nearSpawn(x, z))
          continue
        this.placeStack(kind, x, z)
        index += 1
      }
    }
  }

  private placeStack(kind: ArrowKind, x: number, z: number): void {
    this.arrowStacks.push(new ArrowStack(kind, x, z, ARROW_STACK_SIZE))
  }

  private nearSpawn(x: number, z: number): boolean {
    const reach = PICKUP_RADIUS + 0.5
    return SPAWN_POINTS.some((spawn) => {
      const dx = spawn.x - x
      const dz = spawn.z - z
      return dx * dx + dz * dz < reach * reach
    })
  }

  private stackNear(x: number, z: number): boolean {
    return this.arrowStacks.some((stack) => {
      const dx = stack.x - x
      const dz = stack.z - z
      return dx * dx + dz * dz < 1.2 * 1.2
    })
  }

  private arrowBlocked(x: number, z: number): boolean {
    for (const wall of WALLS) {
      const bounds = wallBounds(wall, 0.8)
      if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) return true
    }
    for (const tree of TREES) {
      const dx = tree.x - x
      const dz = tree.z - z
      const reach = TREE_TRUNK_RADIUS + 0.7
      if (dx * dx + dz * dz < reach * reach) return true
    }
    return false
  }

  private advanceProjectiles(): void {
    const remaining: Projectile[] = []
    for (const projectile of this.projectiles) {
      if (this.fly(projectile)) remaining.push(projectile)
    }
    this.projectiles = remaining
  }

  /** Returns true while the arrow is still in the air. */
  private fly(projectile: Projectile): boolean {
    if (projectile.grounded) {
      projectile.age += TICK_SECONDS
      return projectile.age - projectile.groundedAt < ARROW_REST_MS / 1000
    }
    if (projectile.age > 8) return false
    let remaining = TICK_SECONDS
    for (let bounce = 0; bounce < 5 && remaining > 1e-4; bounce += 1) {
      const ground = timeToGround(projectile.y, projectile.vy)
      const step = ground < remaining ? ground : remaining
      const bendX = projectile.bendX
      const bendZ = projectile.bendZ
      if (bendX !== null && bendZ !== null && !projectile.turned) {
        const reach = Math.hypot(bendX - projectile.x, bendZ - projectile.z)
        const horizontal = Math.hypot(projectile.vx, projectile.vz)
        const bendTime = horizontal > 1e-5 ? reach / horizontal : Number.POSITIVE_INFINITY
        if (bendTime < step) {
          const bent = this.integrate(projectile, bendTime)
          if (bent.kind === 'stopped') return false
          if (bent.kind === 'bounced') {
            remaining -= bent.used
            continue
          }
          if (projectile.grounded) return true
          this.redirect(projectile)
          remaining -= bent.used
          continue
        }
      }
      const result = this.integrate(projectile, step)
      if (result.kind === 'stopped') return false
      if (result.kind === 'bounced') {
        remaining -= result.used
        continue
      }
      if (projectile.grounded) return true
      return true
    }
    return projectile.y > 0.02
  }

  /** Lays the arrow on the ground and keeps its heading for the rest pose. */
  private layDown(projectile: Projectile): void {
    projectile.y = 0
    projectile.vy = 0
    const horizontal = Math.hypot(projectile.vx, projectile.vz)
    if (horizontal > 1e-6) {
      projectile.vx /= horizontal
      projectile.vz /= horizontal
    }
    projectile.grounded = true
    projectile.groundedAt = projectile.age
  }

  /** Points the rest of a hooked shot at the landing spot. Happens once. */
  private redirect(projectile: Projectile): void {
    projectile.turned = true
    projectile.bendX = null
    projectile.bendZ = null
    const dx = projectile.landX - projectile.x
    const dz = projectile.landZ - projectile.z
    const distance = Math.hypot(dx, dz)
    const left = Math.max(timeToGround(projectile.y, projectile.vy), 1e-3)
    const speed = distance / left
    projectile.vx = distance > 1e-6 ? (dx / distance) * speed : 0
    projectile.vz = distance > 1e-6 ? (dz / distance) * speed : 0
  }

  private integrate(projectile: Projectile, dt: number): { kind: 'clear' | 'stopped' | 'bounced'; used: number } {
    if (dt <= 1e-5) return { kind: 'clear', used: 0 }
    const spec = projectile.spec
    const x0 = projectile.x
    const z0 = projectile.z
    const y0 = projectile.y
    const x1 = x0 + projectile.vx * dt
    const z1 = z0 + projectile.vz * dt
    const y1 = y0 + projectile.vy * dt - 0.5 * ARROW_GRAVITY * dt * dt
    const yAt = (t: number) => y0 + (y1 - y0) * t
    const struck = this.findHit(projectile.ownerId, x0, z0, x1, z1, PLAYER_RADIUS + spec.radius)
    const dummyHit = this.findDummy(x0, z0, x1, z1, DUMMY_RADIUS + spec.radius)
    const cover = spec.penetrates ? null : coverHit(x0, z0, x1, z1, spec.radius)
    const border = spec.penetrates ? null : arenaBorderHit(x0, z0, x1, z1, spec.radius)

    let stopT = 1
    let mode: 'clear' | 'player' | 'dummy' | 'cover' | 'border' = 'clear'
    let normalX = 0
    let normalZ = 0
    if (struck && yAt(struck.t) <= HUNTER_HIT_HEIGHT && struck.t < stopT) {
      stopT = struck.t
      mode = 'player'
    }
    if (dummyHit && yAt(dummyHit.t) <= HUNTER_HIT_HEIGHT && dummyHit.t < stopT) {
      stopT = dummyHit.t
      mode = 'dummy'
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
      projectile.x = x1
      projectile.z = z1
      projectile.y = Math.max(0, y1)
      projectile.vy -= ARROW_GRAVITY * dt
      projectile.traveled += Math.hypot(x1 - x0, z1 - z0)
      projectile.age += dt
      if (projectile.y <= 0.02) {
        projectile.y = 0
        if (spec.explodes) {
          this.explode(projectile, projectile.x, projectile.z)
          return { kind: 'stopped', used: dt }
        }
        this.layDown(projectile)
      }
      return { kind: 'clear', used: dt }
    }

    const used = dt * stopT
    const hitX = x0 + (x1 - x0) * stopT
    const hitZ = z0 + (z1 - z0) * stopT
    projectile.x = hitX
    projectile.z = hitZ
    projectile.y = Math.max(0, yAt(stopT))
    projectile.vy -= ARROW_GRAVITY * used
    projectile.traveled += Math.hypot(hitX - x0, hitZ - z0)
    projectile.age += used

    if (mode === 'player' && struck) {
      if (spec.explodes) this.explode(projectile, struck.player.x, struck.player.z)
      else this.applyDamage(struck.player, spec.damage)
      return { kind: 'stopped', used }
    }
    if (mode === 'dummy' && dummyHit) {
      if (spec.explodes) this.explode(projectile, dummyHit.dummy.x, dummyHit.dummy.z)
      else this.hurtDummy(dummyHit.dummy, spec.damage)
      return { kind: 'stopped', used }
    }
    if (spec.explodes) {
      this.explode(projectile, hitX, hitZ)
      return { kind: 'stopped', used }
    }
    if (spec.ricochets && used > 1e-4) {
      const horizontal = Math.hypot(projectile.vx, projectile.vz)
      const reflected = reflect(projectile.vx, projectile.vz, normalX, normalZ)
      const length = Math.hypot(reflected.x, reflected.z)
      if (length < 1e-6) return { kind: 'stopped', used }
      projectile.vx = (reflected.x / length) * horizontal
      projectile.vz = (reflected.z / length) * horizontal
      projectile.x = hitX + normalX * 0.04
      projectile.z = hitZ + normalZ * 0.04
      projectile.bendX = null
      projectile.bendZ = null
      projectile.turned = true
      return { kind: 'bounced', used }
    }
    return { kind: 'stopped', used }
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
    this.explosions.push(
      new Explosion(projectile.ownerId, x, z, projectile.spec.explosionRadius, this.elapsedMs),
    )
    const playerReach = projectile.spec.explosionRadius + PLAYER_RADIUS
    const playerReachSquared = playerReach * playerReach
    for (const player of this.players.values()) {
      if (!player.alive || player.id === projectile.ownerId) continue
      const dx = player.x - x
      const dz = player.z - z
      if (dx * dx + dz * dz > playerReachSquared) continue
      this.applyDamage(player, projectile.spec.damage)
    }
    const dummyReach = projectile.spec.explosionRadius + DUMMY_RADIUS
    const dummyReachSquared = dummyReach * dummyReach
    for (const dummy of this.dummies) {
      if (!dummy.alive) continue
      const dx = dummy.x - x
      const dz = dummy.z - z
      if (dx * dx + dz * dz > dummyReachSquared) continue
      this.hurtDummy(dummy, projectile.spec.damage)
    }
  }

  private hurtDummy(dummy: Dummy, damage: number): void {
    if (!dummy.alive) return
    dummy.hp = Math.max(0, dummy.hp - damage)
    if (dummy.hp > 0) return
    dummy.alive = false
  }

  private findDummy(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    radius: number,
  ): { dummy: Dummy; t: number } | null {
    let closest: Dummy | null = null
    let closestT = Number.POSITIVE_INFINITY
    for (const dummy of this.dummies) {
      if (!dummy.alive) continue
      const t = segmentHitT(x0, z0, x1, z1, dummy.x, dummy.z, radius)
      if (t === null || t >= closestT) continue
      closestT = t
      closest = dummy
    }
    if (!closest) return null
    return { dummy: closest, t: closestT }
  }

  private decayExplosions(): void {
    this.explosions = this.explosions.filter(
      (blast) => this.elapsedMs - blast.bornMs < EXPLOSION_ANIM_MS,
    )
  }

  private dummySnapshots(): DummySnapshot[] {
    return this.dummies.map((dummy) => ({
      id: dummy.id,
      x: dummy.x,
      z: dummy.z,
      hp: dummy.hp,
      alive: dummy.alive,
    }))
  }

  private explosionSnapshots(): ExplosionSnapshot[] {
    return this.explosions.map((blast) => ({
      id: blast.id,
      ownerId: blast.ownerId,
      x: blast.x,
      z: blast.z,
      radius: blast.radius,
      ageMs: Math.max(0, this.elapsedMs - blast.bornMs),
    }))
  }

  private scatterDummies(): void {
    for (const wall of WALLS) {
      const gap = DUMMY_RADIUS + 0.28
      const bounds = wallBounds(wall, gap)
      if (wall.width >= wall.depth) {
        const start = wall.x - wall.width / 2 + 0.7
        const end = wall.x + wall.width / 2 - 0.5
        for (let x = start; x <= end; x += 1.7) {
          this.placeDummy(x, bounds.minZ)
          this.placeDummy(x, bounds.maxZ)
        }
      } else {
        const start = wall.z - wall.depth / 2 + 0.7
        const end = wall.z + wall.depth / 2 - 0.5
        for (let z = start; z <= end; z += 1.7) {
          this.placeDummy(bounds.minX, z)
          this.placeDummy(bounds.maxX, z)
        }
      }
    }
    for (let x = -13; x <= 13; x += 4) {
      for (let z = -13; z <= 13; z += 4) this.placeDummy(x, z)
    }
    this.placeDummy(-12.6, -12.2)
    this.placeDummy(-11.2, -13.4)
    this.placeDummy(12.6, 15.6)
    this.placeDummy(14.8, 16.2)
  }

  private placeDummy(x: number, z: number): void {
    if (this.dummyBlocked(x, z) || this.dummyNear(x, z)) return
    this.dummies.push(new Dummy(x, z))
  }

  private dummyNear(x: number, z: number): boolean {
    return this.dummies.some((dummy) => {
      const dx = dummy.x - x
      const dz = dummy.z - z
      return dx * dx + dz * dz < 1.35 * 1.35
    })
  }

  private dummyBlocked(x: number, z: number): boolean {
    if (this.nearSpawn(x, z)) return true
    for (const wall of WALLS) {
      const bounds = wallBounds(wall, DUMMY_RADIUS)
      if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) return true
    }
    for (const tree of TREES) {
      const dx = tree.x - x
      const dz = tree.z - z
      const reach = TREE_TRUNK_RADIUS + DUMMY_RADIUS
      if (dx * dx + dz * dz < reach * reach) return true
    }
    const limit = arenaLimit(DUMMY_RADIUS)
    return Math.abs(x) > limit || Math.abs(z) > limit
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

function reflect(
  dirX: number,
  dirZ: number,
  normalX: number,
  normalZ: number,
): { x: number; z: number } {
  const dot = dirX * normalX + dirZ * normalZ
  if (dot >= 0) return { x: dirX, z: dirZ }
  return { x: dirX - 2 * dot * normalX, z: dirZ - 2 * dot * normalZ }
}
