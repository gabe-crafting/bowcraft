import {
  BUSH_COLOR,
  BUSH_DARK,
  BUSHES,
  bushRadius,
  COVER_WALL_COLOR,
  COVER_WALL_HEIGHT,
  TREE_LEAF_COLOR,
  TREE_LEAF_DARK,
  TREE_TRUNK_COLOR,
  TREE_TRUNK_RADIUS,
  TREES,
  WALLS,
} from '@bounty/shared'
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'
import { disposeObject } from './dispose'

const TRUNK_HEIGHT = 1.15

export class Scenery {
  readonly group = new Group()

  constructor() {
    const stone = facet(COVER_WALL_COLOR, 0.9)
    const trunk = facet(TREE_TRUNK_COLOR, 0.86)
    const leaf = facet(TREE_LEAF_COLOR, 0.82)
    const leafDark = facet(TREE_LEAF_DARK, 0.86)
    const bush = facet(BUSH_COLOR, 0.84)
    const bushDark = facet(BUSH_DARK, 0.88)

    for (const wall of WALLS) {
      const block = new Mesh(new BoxGeometry(wall.width, COVER_WALL_HEIGHT, wall.depth), stone)
      block.position.set(wall.x, COVER_WALL_HEIGHT / 2, wall.z)
      this.group.add(block)
    }

    for (const [index, tree] of TREES.entries()) {
      this.group.add(makeTree(tree.x, tree.z, index, trunk, index % 2 === 0 ? leaf : leafDark))
    }

    for (const spot of BUSHES) {
      this.group.add(makeBush(spot.x, spot.z, bushRadius(spot), bush, bushDark))
    }
  }

  dispose(): void {
    this.group.removeFromParent()
    disposeObject(this.group)
  }
}

function makeTree(
  x: number,
  z: number,
  index: number,
  trunkMaterial: MeshStandardMaterial,
  leafMaterial: MeshStandardMaterial,
): Group {
  const tree = new Group()
  tree.position.set(x, 0, z)

  const trunk = new Mesh(
    new CylinderGeometry(TREE_TRUNK_RADIUS * 0.55, TREE_TRUNK_RADIUS * 0.72, TRUNK_HEIGHT, 5),
    trunkMaterial,
  )
  trunk.position.y = TRUNK_HEIGHT / 2
  tree.add(trunk)

  const crown = new Mesh(new SphereGeometry(0.92, 5, 4), leafMaterial)
  crown.scale.set(1, 0.72, 1)
  crown.position.y = TRUNK_HEIGHT + 0.35
  tree.add(crown)

  const tuft = new Mesh(new SphereGeometry(0.48, 4, 3), leafMaterial)
  tuft.position.set(index % 2 === 0 ? 0.28 : -0.28, TRUNK_HEIGHT + 0.72, 0.16)
  tree.add(tuft)
  return tree
}

function makeBush(
  x: number,
  z: number,
  radius: number,
  light: MeshStandardMaterial,
  dark: MeshStandardMaterial,
): Group {
  const bush = new Group()
  bush.position.set(x, 0, z)
  bush.scale.setScalar(radius)
  const puffs: readonly [number, number, number, number, MeshStandardMaterial][] = [
    [0, 0.42, 0, 0.62, light],
    [-0.42, 0.32, 0.18, 0.48, dark],
    [0.4, 0.3, -0.22, 0.46, light],
    [0.12, 0.55, 0.38, 0.36, dark],
    [-0.16, 0.28, -0.46, 0.4, light],
    [0.28, 0.62, 0.08, 0.3, dark],
  ]
  for (const [px, py, pz, puffRadius, material] of puffs) {
    const puff = new Mesh(new SphereGeometry(puffRadius, 5, 3), material)
    puff.position.set(px, py, pz)
    bush.add(puff)
  }
  return bush
}

function facet(color: number, roughness: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness })
}
