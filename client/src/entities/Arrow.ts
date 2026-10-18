import { arrowLook, type ArrowLook } from '@bounty/shared'
import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'

/** Arrow along local +Z, centered on the group origin. */
export function makeArrow(length: number, look: ArrowLook = arrowLook('normal')): Group {
  const group = new Group()
  const headLength = length * 0.22
  const shaftLength = length - headLength
  const shaft = new Mesh(
    new BoxGeometry(length * 0.045, length * 0.045, shaftLength),
    wood(look.shaft),
  )
  shaft.position.z = -headLength / 2
  group.add(shaft)

  const head = new Mesh(new ConeGeometry(length * 0.07, headLength, 4), metal(look.head))
  head.geometry.rotateX(Math.PI / 2)
  head.position.z = shaftLength / 2 - headLength / 2
  group.add(head)

  const fletchLength = length * 0.2
  const fletchZ = -shaftLength / 2 - headLength / 2 + fletchLength * 0.35
  const fletch = new Mesh(
    new BoxGeometry(length * 0.012, length * 0.13, fletchLength),
    feather(look.fletching),
  )
  fletch.position.set(0, length * 0.045, fletchZ)
  group.add(fletch)

  const fletchSide = new Mesh(
    new BoxGeometry(length * 0.13, length * 0.012, fletchLength),
    feather(look.fletching),
  )
  fletchSide.position.set(0, 0, fletchZ)
  group.add(fletchSide)

  return group
}

/** A normal arrow with a small white bulb just ahead of the head. */
export function makeFlareArrow(length: number): Group {
  const arrow = makeArrow(length, arrowLook('normal'))
  const bulb = new Mesh(
    new SphereGeometry(length * 0.085, 8, 6),
    new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  )
  const headLength = length * 0.22
  const shaftLength = length - headLength
  bulb.position.z = shaftLength / 2 + length * 0.05
  arrow.add(bulb)
  return arrow
}

function wood(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.82 })
}

function metal(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.35,
    metalness: 0.55,
  })
}

function feather(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.7 })
}
