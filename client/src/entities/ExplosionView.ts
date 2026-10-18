import { EXPLOSION_ANIM_MS } from '@bounty/shared'
import {
  BoxGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
} from 'three'
import { disposeObject } from '../scene/dispose'

const SHARDS = 8

export class ExplosionView {
  readonly group = new Group()
  private readonly ring: Mesh
  private readonly core: Mesh
  private readonly shards: Mesh[] = []

  constructor() {
    this.ring = new Mesh(
      new TorusGeometry(1, 0.07, 5, 18),
      blast(0xffb03a, 0.9),
    )
    this.ring.rotation.x = Math.PI / 2
    this.ring.position.y = 0.08
    this.core = new Mesh(new IcosahedronGeometry(0.42, 0), blast(0xfff1c4, 1))
    this.core.position.y = 0.45
    this.group.add(this.ring, this.core)

    for (let index = 0; index < SHARDS; index += 1) {
      const shard = new Mesh(new BoxGeometry(0.16, 0.16, 0.28), blast(index % 2 === 0 ? 0xff6a1a : 0xffd15a, 1))
      shard.userData.angle = (index / SHARDS) * Math.PI * 2
      this.shards.push(shard)
      this.group.add(shard)
    }
  }

  setBlast(x: number, z: number, radius: number, ageMs: number): void {
    this.group.position.set(x, 0, z)
    const t = Math.min(1, Math.max(0, ageMs / EXPLOSION_ANIM_MS))
    const spread = 1 - (1 - t) * (1 - t)
    const fade = 1 - t
    const ringScale = radius * (0.18 + 0.9 * spread)
    this.ring.scale.set(ringScale, ringScale, 1)
    setOpacity(this.ring, fade * 0.9)
    const coreScale = 0.35 + (1 - t) * 0.9
    this.core.scale.setScalar(coreScale)
    this.core.position.y = 0.35 + spread * 0.25
    setOpacity(this.core, fade)

    for (const shard of this.shards) {
      const angle = typeof shard.userData.angle === 'number' ? shard.userData.angle : 0
      const distance = radius * (0.15 + 0.95 * spread)
      shard.position.set(Math.cos(angle) * distance, 0.25 + spread * 1.1, Math.sin(angle) * distance)
      shard.rotation.y = angle
      shard.rotation.x = spread * 1.4
      shard.scale.setScalar(0.7 + fade)
      setOpacity(shard, fade)
    }
  }

  dispose(): void {
    this.group.removeFromParent()
    disposeObject(this.group)
  }
}

function blast(color: number, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  })
}

function setOpacity(mesh: Mesh, opacity: number): void {
  const material = mesh.material
  if (material instanceof MeshBasicMaterial) material.opacity = opacity
}
