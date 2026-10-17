import { PROJECTILE_COLOR } from '@bounty/shared'
import { BoxGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial } from 'three'

const SHAFT_COLOR = 0xc9a36a
const HEAD_COLOR = 0xd5d8df

/** Arrow along local +Z, centered on the group origin. */
export function makeArrow(length: number): Group {
  const group = new Group()
  const headLength = length * 0.22
  const shaftLength = length - headLength
  const shaft = new Mesh(new BoxGeometry(length * 0.045, length * 0.045, shaftLength), wood())
  shaft.position.z = -headLength / 2
  group.add(shaft)

  const head = new Mesh(new ConeGeometry(length * 0.07, headLength, 4), metal())
  head.geometry.rotateX(Math.PI / 2)
  head.position.z = shaftLength / 2 - headLength / 2
  group.add(head)

  const fletchLength = length * 0.2
  const fletchZ = -shaftLength / 2 - headLength / 2 + fletchLength * 0.35
  const fletch = new Mesh(
    new BoxGeometry(length * 0.012, length * 0.13, fletchLength),
    feather(),
  )
  fletch.position.set(0, length * 0.045, fletchZ)
  group.add(fletch)

  const fletchSide = new Mesh(
    new BoxGeometry(length * 0.13, length * 0.012, fletchLength),
    feather(),
  )
  fletchSide.position.set(0, 0, fletchZ)
  group.add(fletchSide)

  return group
}

function wood(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: SHAFT_COLOR, flatShading: true, roughness: 0.82 })
}

function metal(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: HEAD_COLOR,
    flatShading: true,
    roughness: 0.35,
    metalness: 0.55,
  })
}

function feather(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: PROJECTILE_COLOR, flatShading: true, roughness: 0.7 })
}
