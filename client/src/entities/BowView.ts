import type { WeaponKind } from '@bounty/shared'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { disposeObject } from '../scene/dispose'
import { makeArrow } from './Arrow'

const LONG_WOOD = 0x6b3f24
const SHORT_WOOD = 0xc49255
const GRIP_COLOR = 0x3a2a22
const STRING_COLOR = 0xf4f0e8

const PULL_MS = 220
const HOLD_MS = 80
const RELEASE_MS = 110
const SHOT_MS = PULL_MS + HOLD_MS + RELEASE_MS

const Y_AXIS = new Vector3(0, 1, 0)
const stringDirection = new Vector3()

interface BowShape {
  height: number
  bend: number
  segments: number
  thickness: number
  draw: number
  wood: number
}

const SHAPES: Record<WeaponKind, BowShape> = {
  longbow: { height: 1.2, bend: 0.22, segments: 7, thickness: 0.065, draw: 0.42, wood: LONG_WOOD },
  shortbow: { height: 0.78, bend: 0.14, segments: 5, thickness: 0.06, draw: 0.28, wood: SHORT_WOOD },
}

export class BowView {
  readonly group = new Group()
  private readonly upperString: Mesh
  private readonly lowerString: Mesh
  private readonly nock = new Group()
  private readonly height: number
  private readonly bend: number
  private readonly drawDistance: number
  private shotStarted = -1

  constructor(kind: WeaponKind, showArrow = true) {
    const shape = SHAPES[kind]
    this.height = shape.height
    this.bend = shape.bend
    this.drawDistance = shape.draw

    const wood = new MeshStandardMaterial({
      color: shape.wood,
      flatShading: true,
      roughness: 0.78,
    })
    const span = shape.height / (shape.segments - 1)
    for (let index = 0; index < shape.segments; index += 1) {
      const t = index / (shape.segments - 1)
      const arc = (t - 0.5) * 2
      const bulge = shape.bend * (1 - arc * arc)
      const piece = new Mesh(
        new BoxGeometry(shape.thickness, span * 1.15, shape.thickness * 0.7),
        wood,
      )
      piece.position.set(0, arc * (shape.height / 2), bulge)
      piece.rotation.x = Math.atan2(-4 * shape.bend * arc, shape.height)
      this.group.add(piece)
    }

    const grip = new Mesh(
      new BoxGeometry(shape.thickness * 1.5, shape.height * 0.14, shape.thickness * 1.4),
      new MeshStandardMaterial({ color: GRIP_COLOR, flatShading: true, roughness: 0.9 }),
    )
    grip.position.set(0, 0, shape.bend)
    this.group.add(grip)

    const stringMaterial = new MeshStandardMaterial({ color: STRING_COLOR, roughness: 0.45 })
    this.upperString = new Mesh(new BoxGeometry(0.012, 1, 0.012), stringMaterial)
    this.lowerString = new Mesh(new BoxGeometry(0.012, 1, 0.012), stringMaterial.clone())
    this.group.add(this.upperString, this.lowerString)

    if (showArrow) {
      const arrowLength = shape.height * 0.42
      const arrow = makeArrow(arrowLength)
      arrow.position.z = arrowLength / 2
      this.nock.add(arrow)
    }
    this.group.add(this.nock)
    this.poseString(0)
  }

  loose(now: number): void {
    this.shotStarted = now
  }

  pose(now: number): void {
    let draw = 0
    if (this.shotStarted >= 0) {
      const age = now - this.shotStarted
      if (age < PULL_MS) draw = age / PULL_MS
      else if (age < PULL_MS + HOLD_MS) draw = 1
      else if (age < SHOT_MS) draw = 1 - (age - PULL_MS - HOLD_MS) / RELEASE_MS
      else this.shotStarted = -1
    }
    const age = this.shotStarted < 0 ? -1 : now - this.shotStarted
    this.nock.visible = age >= 0 && age < PULL_MS + HOLD_MS
    this.poseString(draw)
  }

  nockLocal(out: Vector3): Vector3 {
    return out.copy(this.nock.position)
  }

  gripLocal(out: Vector3): Vector3 {
    return out.set(0, 0, this.bend)
  }

  dispose(): void {
    this.group.removeFromParent()
    disposeObject(this.group)
  }

  private poseString(draw: number): void {
    const nockZ = -this.drawDistance * draw
    this.nock.position.set(0, 0, nockZ)
    stretch(this.upperString, this.height / 2, nockZ)
    stretch(this.lowerString, -this.height / 2, nockZ)
  }
}

function stretch(mesh: Mesh, tipY: number, nockZ: number): void {
  stringDirection.set(0, -tipY, nockZ)
  const length = stringDirection.length()
  if (length === 0) return
  stringDirection.multiplyScalar(1 / length)
  mesh.position.set(0, tipY / 2, nockZ / 2)
  mesh.quaternion.setFromUnitVectors(Y_AXIS, stringDirection)
  mesh.scale.set(1, length, 1)
}
