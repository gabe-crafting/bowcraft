import {
  AMBIENT_COLOR,
  AMBIENT_INTENSITY,
  CAMERA_DISTANCE,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_HEIGHT,
  CAMERA_LOOK_HEIGHT,
  CAMERA_NEAR,
  MAX_PIXEL_RATIO,
  NAMEPLATE_HEIGHT,
  PICKUP_RADIUS,
  PLAYER_COLORS,
  SKY_COLOR,
  SUN_COLOR,
  SUN_INTENSITY,
  SUN_POSITION_X,
  SUN_POSITION_Y,
  SUN_POSITION_Z,
  type ArrowStackSnapshot,
  type DummySnapshot,
  type ExplosionSnapshot,
  type PlayerSnapshot,
  type ProjectileSnapshot,
  type WeaponKind,
  type WeaponSnapshot,
} from '@bounty/shared'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { ArrowStackView } from '../entities/ArrowStackView'
import { DummyView } from '../entities/DummyView'
import { ExplosionView } from '../entities/ExplosionView'
import { PlayerView } from '../entities/PlayerView'
import { ProjectileView } from '../entities/ProjectileView'
import { WeaponView } from '../entities/WeaponView'
import type { InputManager } from '../input/InputManager'
import type { Connection } from '../net/Connection'
import type { SnapshotBuffer } from '../net/SnapshotBuffer'
import type { Hud } from '../ui/Hud'
import { RadialMenu, type RadialOption } from '../ui/RadialMenu'
import { Arena } from './Arena'
import { Fog } from './Fog'
import { Scenery } from './Scenery'

export interface SceneOptions {
  parent: HTMLElement
  connection: Connection
  buffer: SnapshotBuffer
  input: InputManager
  hud: Hud
  playerId: string
}

export class SceneManager {
  private readonly parent: HTMLElement
  private readonly connection: Connection
  private readonly buffer: SnapshotBuffer
  private readonly input: InputManager
  private readonly hud: Hud
  private readonly playerId: string
  private readonly scene = new Scene()
  /** The local hunter's own arrows and blasts, drawn after the fog. */
  private readonly revealed = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly renderer: WebGLRenderer
  private readonly arena = new Arena()
  private readonly scenery = new Scenery()
  private readonly fog = new Fog()
  private readonly playerViews = new Map<string, PlayerView>()
  private readonly projectileViews = new Map<string, ProjectileView>()
  private readonly weaponViews = new Map<string, WeaponView>()
  private readonly stackViews = new Map<string, ArrowStackView>()
  private readonly dummyViews = new Map<string, DummyView>()
  private readonly explosionViews = new Map<string, ExplosionView>()
  private readonly radial: RadialMenu
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0)
  private readonly aimPoint = new Vector3()
  private readonly labelPoint = new Vector3()
  private lastAim = 0
  private lastAimX = 0
  private lastAimZ = 0
  private readonly knownShots = new Set<string>()
  private raf = 0
  private stopped = false

  constructor(options: SceneOptions) {
    this.parent = options.parent
    this.connection = options.connection
    this.buffer = options.buffer
    this.input = options.input
    this.hud = options.hud
    this.playerId = options.playerId
    this.radial = new RadialMenu(options.parent)
    this.hud.onSelect((slot) => this.input.select(slot))

    this.scene.background = new Color(SKY_COLOR)
    this.scene.add(this.arena.group)
    this.scene.add(this.scenery.group)
    this.scene.add(new AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY))

    const sun = new DirectionalLight(SUN_COLOR, SUN_INTENSITY)
    sun.position.set(SUN_POSITION_X, SUN_POSITION_Y, SUN_POSITION_Z)
    this.scene.add(sun)

    this.camera = new PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR)
    this.camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE)
    this.camera.lookAt(0, CAMERA_LOOK_HEIGHT, 0)

    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.parent.append(this.renderer.domElement)
    this.resize()
  }

  start(): void {
    window.addEventListener('resize', this.resize)
    this.raf = requestAnimationFrame(this.frame)
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resize)

    for (const view of this.playerViews.values()) view.dispose()
    for (const view of this.projectileViews.values()) view.dispose()
    for (const view of this.weaponViews.values()) view.dispose()
    for (const view of this.stackViews.values()) view.dispose()
    for (const view of this.dummyViews.values()) view.dispose()
    for (const view of this.explosionViews.values()) view.dispose()
    this.playerViews.clear()
    this.projectileViews.clear()
    this.weaponViews.clear()
    this.stackViews.clear()
    this.dummyViews.clear()
    this.explosionViews.clear()
    this.radial.dispose()
    this.fog.dispose()
    this.scenery.dispose()
    this.arena.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.hud.clear()
  }

  private readonly resize = (): void => {
    const width = this.parent.clientWidth
    const height = Math.max(this.parent.clientHeight, 1)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height)
    this.fog.setSize(Math.floor(width * pixelRatio), Math.floor(height * pixelRatio))
  }

  private readonly frame = (now: number): void => {
    if (this.stopped) return

    const sample = this.buffer.sample(now)
    if (sample) {
      this.syncPlayers(sample.players, sample.weapons, now)
      this.syncProjectiles(sample.projectiles, sample.players, now)
      this.syncWeapons(sample.weapons)
      this.syncStacks(sample.stacks)
      this.syncDummies(sample.dummies)
      this.syncExplosions(sample.explosions)
      const local = sample.players.find((player) => player.id === this.playerId) ?? null
      this.updateCamera(local)
      if (local) {
        const aim = this.aimFrom(local.x, local.z)
        const flares = sample.projectiles.filter((projectile) => projectile.arrow === 'flare')
        this.fog.follow(local.x, local.z, aim.aim, this.camera, flares)
        this.connection.sendInput(this.input.consume(aim.aim, aim.x, aim.z))
        this.updateWeaponMenu(local, sample.weapons)
      } else {
        this.radial.setOpen(false)
      }
      this.updateHud(sample.players, sample.weapons)
    }

    this.fog.render(this.renderer, this.scene, this.camera, this.revealed)
    this.raf = requestAnimationFrame(this.frame)
  }

  private updateCamera(local: PlayerSnapshot | null): void {
    if (!local) return
    this.camera.position.set(local.x, CAMERA_HEIGHT, local.z + CAMERA_DISTANCE)
    this.camera.lookAt(local.x, CAMERA_LOOK_HEIGHT, local.z)
  }

  private aimFrom(originX: number, originZ: number): { aim: number; x: number; z: number } {
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return { aim: this.lastAim, x: this.lastAimX, z: this.lastAimZ }
    }

    const pointer = this.input.pointer
    this.pointer.set(
      ((pointer.x - rect.left) / rect.width) * 2 - 1,
      -((pointer.y - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = this.raycaster.ray.intersectPlane(this.ground, this.aimPoint)
    if (!hit) return { aim: this.lastAim, x: this.lastAimX, z: this.lastAimZ }

    this.lastAim = Math.atan2(hit.x - originX, hit.z - originZ)
    this.lastAimX = hit.x
    this.lastAimZ = hit.z
    return { aim: this.lastAim, x: hit.x, z: hit.z }
  }

  private syncPlayers(
    players: readonly PlayerSnapshot[],
    weapons: readonly WeaponSnapshot[],
    now: number,
  ): void {
    const seen = new Set<string>()
    for (const player of players) {
      seen.add(player.id)
      let view = this.playerViews.get(player.id)
      if (!view) {
        view = new PlayerView(colorAt(player.color))
        this.scene.add(view.group)
        this.playerViews.set(player.id, view)
      }
      view.setVisible(player.alive)
      view.setBow(bowKind(player.weaponId, weapons))
      view.setArrow(player.selected)
      view.setConcealed(player.hidden)
      view.setTransform(player.x, player.z, player.aim)
      view.update(now)
    }
    this.dropMissing(this.playerViews, seen)
  }

  private syncProjectiles(
    projectiles: readonly ProjectileSnapshot[],
    players: readonly PlayerSnapshot[],
    now: number,
  ): void {
    const seen = new Set<string>()
    for (const projectile of projectiles) {
      seen.add(projectile.id)
      if (!this.knownShots.has(projectile.id)) {
        this.knownShots.add(projectile.id)
        if (shotJustLeft(projectile, players, this.playerId)) {
          this.playerViews.get(projectile.ownerId)?.loose(now)
        }
      }
      let view = this.projectileViews.get(projectile.id)
      if (!view) {
        view = new ProjectileView(projectile.arrow)
        const parent = projectile.ownerId === this.playerId ? this.revealed : this.scene
        parent.add(view.group)
        this.projectileViews.set(projectile.id, view)
      }
      view.setPose(projectile.x, projectile.y, projectile.z, projectile.dirX, projectile.dirY, projectile.dirZ)
    }
    this.dropMissing(this.projectileViews, seen)
    for (const id of this.knownShots) {
      if (!seen.has(id)) this.knownShots.delete(id)
    }
  }

  private syncWeapons(weapons: readonly WeaponSnapshot[]): void {
    const seen = new Set<string>()
    for (const weapon of weapons) {
      if (weapon.heldBy !== null) continue
      seen.add(weapon.id)
      let view = this.weaponViews.get(weapon.id)
      if (!view) {
        view = new WeaponView(weapon.kind)
        this.scene.add(view.group)
        this.weaponViews.set(weapon.id, view)
      }
      view.setPosition(weapon.x, weapon.z)
    }
    this.dropMissing(this.weaponViews, seen)
  }

  private syncStacks(stacks: readonly ArrowStackSnapshot[]): void {
    const seen = new Set<string>()
    for (const stack of stacks) {
      seen.add(stack.id)
      let view = this.stackViews.get(stack.id)
      if (!view) {
        view = new ArrowStackView(stack.kind)
        this.scene.add(view.group)
        this.stackViews.set(stack.id, view)
      }
      view.setPosition(stack.x, stack.z)
    }
    this.dropMissing(this.stackViews, seen)
  }

  private syncDummies(dummies: readonly DummySnapshot[]): void {
    const seen = new Set<string>()
    for (const dummy of dummies) {
      seen.add(dummy.id)
      let view = this.dummyViews.get(dummy.id)
      if (!view) {
        view = new DummyView()
        this.scene.add(view.group)
        this.dummyViews.set(dummy.id, view)
        view.setPosition(dummy.x, dummy.z)
      }
      view.setState(dummy.hp, dummy.alive)
    }
    this.dropMissing(this.dummyViews, seen)
  }

  private syncExplosions(explosions: readonly ExplosionSnapshot[]): void {
    const seen = new Set<string>()
    for (const blast of explosions) {
      seen.add(blast.id)
      let view = this.explosionViews.get(blast.id)
      if (!view) {
        view = new ExplosionView()
        const parent = blast.ownerId === this.playerId ? this.revealed : this.scene
        parent.add(view.group)
        this.explosionViews.set(blast.id, view)
      }
      view.setBlast(blast.x, blast.z, blast.radius, blast.ageMs)
    }
    this.dropMissing(this.explosionViews, seen)
  }

  private updateWeaponMenu(local: PlayerSnapshot, weapons: readonly WeaponSnapshot[]): void {
    const menu = this.input.pullMenu()
    const show = local.alive && (menu.held || menu.released)
    this.radial.setOptions(weaponOptions(local, weapons))
    this.radial.setOpen(show)
    this.radial.pointAt(this.input.pointer.x, this.input.pointer.y)
    const action = menu.released ? this.radial.selected() : null
    this.radial.setOpen(menu.held && local.alive)
    if (action) this.connection.sendAction(action)
  }

  private dropMissing<T extends { dispose: () => void }>(
    views: Map<string, T>,
    seen: Set<string>,
  ): void {
    for (const [id, view] of views) {
      if (seen.has(id)) continue
      view.dispose()
      views.delete(id)
    }
  }

  private updateHud(players: readonly PlayerSnapshot[], weapons: readonly WeaponSnapshot[]): void {
    const width = this.parent.clientWidth
    const height = this.parent.clientHeight
    const local = players.find((player) => player.id === this.playerId) ?? null
    this.hud.syncLoadout(local, local ? bowKind(local.weaponId, weapons) : null)
    this.hud.sync(
      players.map((player) => {
        this.labelPoint.set(player.x, NAMEPLATE_HEIGHT, player.z)
        this.labelPoint.project(this.camera)
        return {
          id: player.id,
          username: player.username,
          hp: Math.max(0, Math.round(player.hp)),
          screenX: (this.labelPoint.x * 0.5 + 0.5) * width,
          screenY: (-this.labelPoint.y * 0.5 + 0.5) * height,
          visible: player.alive && this.labelPoint.z >= -1 && this.labelPoint.z <= 1,
        }
      }),
    )
  }
}

const SHOT_ANIM_DISTANCE = 2.5

function colorAt(index: number): number {
  return PLAYER_COLORS[index] ?? PLAYER_COLORS[0]
}

function bowKind(weaponId: string | null, weapons: readonly WeaponSnapshot[]): WeaponKind | null {
  if (!weaponId) return null
  return weapons.find((weapon) => weapon.id === weaponId)?.kind ?? null
}

function shotJustLeft(
  projectile: ProjectileSnapshot,
  players: readonly PlayerSnapshot[],
  viewerId: string,
): boolean {
  if (projectile.ownerId === viewerId) return true
  const owner = players.find((player) => player.id === projectile.ownerId)
  if (!owner) return false
  const dx = projectile.x - owner.x
  const dz = projectile.z - owner.z
  return dx * dx + dz * dz <= SHOT_ANIM_DISTANCE * SHOT_ANIM_DISTANCE
}

function weaponOptions(local: PlayerSnapshot, weapons: readonly WeaponSnapshot[]): RadialOption[] {
  if (!local.alive) return []
  if (local.weaponId) return [{ id: 'drop', label: 'Drop' }]
  const reach = PICKUP_RADIUS * PICKUP_RADIUS
  const nearby = weapons.some((weapon) => {
    if (weapon.heldBy !== null) return false
    const dx = weapon.x - local.x
    const dz = weapon.z - local.z
    return dx * dx + dz * dz <= reach
  })
  if (nearby) return [{ id: 'pickup', label: 'Pick up' }]
  return []
}
