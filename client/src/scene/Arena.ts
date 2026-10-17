import { ARENA_SIZE, GROUND_COLOR, WALL_COLOR, WALL_HEIGHT, WALL_THICKNESS } from '@bounty/shared'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { disposeObject } from './dispose'

export class Arena {
  readonly group = new Group()

  constructor() {
    const groundSize = ARENA_SIZE + WALL_THICKNESS * 2
    const ground = new Mesh(
      new PlaneGeometry(groundSize, groundSize),
      new MeshStandardMaterial({ color: GROUND_COLOR, roughness: 0.95 }),
    )
    ground.rotation.x = -Math.PI / 2
    this.group.add(ground)

    const span = ARENA_SIZE + WALL_THICKNESS * 2
    const edge = ARENA_SIZE / 2 + WALL_THICKNESS / 2
    this.addWall(0, -edge, span, WALL_THICKNESS)
    this.addWall(0, edge, span, WALL_THICKNESS)
    this.addWall(-edge, 0, WALL_THICKNESS, span)
    this.addWall(edge, 0, WALL_THICKNESS, span)
  }

  dispose(): void {
    this.group.removeFromParent()
    disposeObject(this.group)
  }

  private addWall(x: number, z: number, width: number, depth: number): void {
    const wall = new Mesh(
      new BoxGeometry(width, WALL_HEIGHT, depth),
      new MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.86 }),
    )
    wall.position.set(x, WALL_HEIGHT / 2, z)
    this.group.add(wall)
  }
}
