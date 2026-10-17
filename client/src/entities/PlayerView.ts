import type { WeaponKind } from '@bounty/shared'
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { disposeObject } from '../scene/dispose'
import { BowView } from './BowView'

const SKIN = 0xe0b08a
const BOOT = 0x2a2420
const LIMB_THICKNESS = 0.1
const Y_AXIS = new Vector3(0, 1, 0)

const LEFT_SHOULDER = new Vector3(-0.28, 1.18, 0.02)
const RIGHT_SHOULDER = new Vector3(0.28, 1.18, 0.02)
const BOW_POSITION = new Vector3(-0.06, 1.02, 0.16)
const HIP_Y = 0.58
const WALK_RATE = 9
const STRIDE = 1.15

export class PlayerView {
  readonly group = new Group()
  private bow: BowView | null = null
  private bowKind: WeaponKind | null = null
  private readonly bowArm: Mesh
  private readonly drawArm: Mesh
  private readonly leftLeg: Group
  private readonly rightLeg: Group
  private readonly limbDirection = new Vector3()
  private readonly nock = new Vector3()
  private readonly grip = new Vector3()
  private readonly hangLeft = new Vector3()
  private readonly hangRight = new Vector3()
  private walkPhase = 0
  private legSwing = 0
  private lastStep = -1
  private lastX = 0
  private lastZ = 0
  private stepDistance = 0
  private placed = false

  constructor(color: number) {
    const tunic = facet(color)
    const cloth = facet(new Color(color).offsetHSL(0, -0.05, -0.22).getHex())
    const skin = facet(SKIN)
    const hair = facet(new Color(color).offsetHSL(0, -0.1, -0.38).getHex())
    const boot = facet(BOOT)

    this.leftLeg = makeLeg(-0.11, cloth, boot)
    this.rightLeg = makeLeg(0.11, cloth, boot)
    this.group.add(this.leftLeg, this.rightLeg)

    const hips = new Mesh(new BoxGeometry(0.4, 0.18, 0.24), tunic)
    hips.position.set(0, 0.62, 0)
    this.group.add(hips)

    const torso = new Mesh(new CylinderGeometry(0.2, 0.26, 0.48, 6), tunic)
    torso.position.set(0, 0.94, 0)
    this.group.add(torso)

    const head = new Mesh(new SphereGeometry(0.2, 5, 4), skin)
    head.position.set(0, 1.32, 0.02)
    this.group.add(head)

    const cap = new Mesh(new SphereGeometry(0.16, 4, 3), hair)
    cap.scale.y = 0.62
    cap.position.set(0, 1.44, -0.02)
    this.group.add(cap)

    this.bowArm = limb()
    this.drawArm = limb()
    this.group.add(this.bowArm, this.drawArm)
    this.poseArms()
  }

  setTransform(x: number, z: number, aim: number): void {
    if (this.placed) this.stepDistance = Math.hypot(x - this.lastX, z - this.lastZ)
    this.placed = true
    this.lastX = x
    this.lastZ = z
    this.group.position.set(x, 0, z)
    this.group.rotation.y = aim
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  setBow(kind: WeaponKind | null): void {
    if (this.bowKind === kind) return
    this.bowKind = kind
    if (this.bow) {
      this.bow.dispose()
      this.bow = null
    }
    if (!kind) {
      this.poseArms()
      return
    }
    this.bow = new BowView(kind)
    this.bow.group.position.copy(BOW_POSITION)
    this.group.add(this.bow.group)
    this.poseArms()
  }

  loose(now: number): void {
    this.bow?.loose(now)
  }

  update(now: number): void {
    const dt = this.lastStep < 0 ? 0 : Math.min(0.05, (now - this.lastStep) / 1000)
    this.lastStep = now
    const moving = this.stepDistance > 0.004
    if (moving) this.walkPhase += dt * WALK_RATE
    const stride = moving ? Math.sin(this.walkPhase) * STRIDE : 0
    this.legSwing += (stride - this.legSwing) * Math.min(1, dt * 14 + (dt === 0 ? 1 : 0))
    this.leftLeg.rotation.x = this.legSwing
    this.rightLeg.rotation.x = -this.legSwing
    this.group.position.y = Math.abs(this.legSwing) * 0.06
    this.bow?.pose(now)
    this.poseArms()
  }

  dispose(): void {
    this.group.removeFromParent()
    disposeObject(this.group)
  }

  private poseArms(): void {
    const gripTarget = this.bow
      ? this.bow.gripLocal(this.grip).add(BOW_POSITION)
      : this.hangLeft.set(-0.34, 0.68, this.legSwing * 0.4)
    pointLimb(this.bowArm, LEFT_SHOULDER, gripTarget, this.limbDirection)
    const drawTarget = this.bow
      ? this.bow.nockLocal(this.nock).add(BOW_POSITION)
      : this.hangRight.set(0.34, 0.68, -this.legSwing * 0.4)
    pointLimb(this.drawArm, RIGHT_SHOULDER, drawTarget, this.limbDirection)
  }
}

function makeLeg(x: number, cloth: MeshStandardMaterial, boot: MeshStandardMaterial): Group {
  const leg = new Group()
  leg.position.set(x, HIP_Y, 0)
  const thigh = new Mesh(new BoxGeometry(0.15, 0.34, 0.16), cloth)
  thigh.position.y = -0.17
  const foot = new Mesh(new BoxGeometry(0.16, 0.14, 0.28), boot)
  foot.position.set(0, -0.42, 0.05)
  leg.add(thigh, foot)
  return leg
}

function limb(): Mesh {
  return new Mesh(
    new BoxGeometry(LIMB_THICKNESS, 1, LIMB_THICKNESS),
    new MeshStandardMaterial({ color: SKIN, flatShading: true, roughness: 0.72 }),
  )
}

function pointLimb(mesh: Mesh, from: Vector3, to: Vector3, direction: Vector3): void {
  direction.subVectors(to, from)
  const length = direction.length()
  if (length < 0.001) return
  direction.multiplyScalar(1 / length)
  mesh.position.copy(from).addScaledVector(direction, length / 2)
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction)
  mesh.scale.set(1, length, 1)
}

function facet(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.78 })
}
