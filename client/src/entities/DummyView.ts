import { DUMMY_HP } from '@bounty/shared'
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'
import { disposeObject } from '../scene/dispose'

const POST = 0x6a4328
const STRAW = 0xd7b15a
const STRAW_DARK = 0xb08a3e
const TARGET = 0xc4473a
const BAR = 0x8fd18a

export class DummyView {
  readonly group = new Group()
  private readonly body = new Group()
  private readonly fill: Mesh
  private readonly bar: Group

  constructor() {
    const wood = facet(POST)
    const straw = facet(STRAW)
    const dark = facet(STRAW_DARK)
    const post = new Mesh(new CylinderGeometry(0.08, 0.1, 1.15, 6), wood)
    post.position.y = 0.58
    const torso = new Mesh(new BoxGeometry(0.46, 0.48, 0.28), straw)
    torso.position.y = 1.05
    const head = new Mesh(new SphereGeometry(0.16, 6, 5), dark)
    head.position.y = 1.42
    const mark = new Mesh(new BoxGeometry(0.16, 0.16, 0.04), facet(TARGET))
    mark.position.set(0, 1.05, 0.15)
    this.body.add(post, torso, head, mark)
    this.group.add(this.body)

    this.bar = new Group()
    this.bar.position.y = 1.72
    const track = new Mesh(new BoxGeometry(0.52, 0.08, 0.05), facet(0x1c2018))
    this.fill = new Mesh(new BoxGeometry(0.48, 0.05, 0.06), facet(BAR))
    this.fill.position.z = 0.01
    this.bar.add(track, this.fill)
    this.group.add(this.bar)
  }

  setState(hp: number, alive: boolean): void {
    const ratio = Math.min(1, Math.max(0, hp / DUMMY_HP))
    this.fill.scale.x = Math.max(ratio, 0.001)
    this.fill.position.x = (ratio - 1) * 0.24
    this.bar.visible = alive
    this.body.rotation.x = alive ? 0 : 1.25
    this.body.position.y = alive ? 0 : 0.15
  }

  setPosition(x: number, z: number): void {
    this.group.position.set(x, 0, z)
  }

  dispose(): void {
    this.group.removeFromParent()
    disposeObject(this.group)
  }
}

function facet(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.86 })
}
