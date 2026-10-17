/** Axis-aligned stone wall. `x` and `z` are the center. `width` runs along X, `depth` along Z. */
export interface WallBlock {
  x: number
  z: number
  width: number
  depth: number
}

/** Solid trunk. The canopy is wider and does not block movement or arrows. */
export interface TreeSpot {
  x: number
  z: number
}

/** Soft thicket. Hunters and arrows pass through it. */
export interface BushSpot {
  x: number
  z: number
  scale: number
}

export const WALLS: readonly WallBlock[] = [
  { x: -9.5, z: -14.6, width: 0.7, depth: 2.6 },
  { x: 9.5, z: 14.6, width: 0.7, depth: 2.6 },
  { x: -5.5, z: -3, width: 6.4, depth: 0.7 },
  { x: 6.6, z: 1.4, width: 0.7, depth: 5.8 },
  { x: -1, z: 7.6, width: 5.4, depth: 0.7 },
  { x: 2.2, z: -8.6, width: 4.4, depth: 0.7 },
  { x: -9.2, z: 5.2, width: 0.7, depth: 3.4 },
]

export const TREES: readonly TreeSpot[] = [
  { x: -16.3, z: -11.5 },
  { x: 16.3, z: 11.5 },
  { x: -9, z: 1 },
  { x: 3.2, z: -3.6 },
  { x: 10.2, z: 6.2 },
  { x: -3.2, z: 11.2 },
  { x: 8.4, z: -10.2 },
  { x: -8.2, z: -8.4 },
  { x: 1.2, z: 3.2 },
  { x: 14.2, z: -3.5 },
  { x: -14.2, z: 5.5 },
  { x: 4.4, z: 12.2 },
]

export const BUSHES: readonly BushSpot[] = [
  { x: -15.5, z: -15.2, scale: 0.95 },
  { x: -13.6, z: -16.2, scale: 0.72 },
  { x: 15.5, z: 15.2, scale: 0.95 },
  { x: 13.6, z: 16.2, scale: 0.72 },
  { x: -7.4, z: -1.1, scale: 1 },
  { x: -3.6, z: -4.5, scale: 0.82 },
  { x: -10.2, z: 2.4, scale: 0.9 },
  { x: 1.6, z: 1.2, scale: 1.05 },
  { x: 4.8, z: -2.1, scale: 0.78 },
  { x: 8.6, z: 4.6, scale: 0.95 },
  { x: 6.8, z: -8.8, scale: 0.88 },
  { x: -6.2, z: -9.6, scale: 1.08 },
  { x: -2.4, z: 9.4, scale: 0.8 },
  { x: 2.6, z: 10.2, scale: 0.92 },
  { x: 12.2, z: 3.6, scale: 0.84 },
  { x: -12.4, z: 3.4, scale: 1 },
  { x: 5.4, z: -12.4, scale: 0.76 },
  { x: -1.6, z: -11.6, scale: 1.02 },
  { x: 9.4, z: -1.4, scale: 0.8 },
  { x: -4.2, z: 4.2, scale: 0.86 },
  { x: 0.4, z: -5.2, scale: 0.74 },
  { x: -11.4, z: -4.6, scale: 0.9 },
]

export function wallBounds(wall: WallBlock, padding = 0): {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
} {
  const halfWidth = wall.width / 2 + padding
  const halfDepth = wall.depth / 2 + padding
  return {
    minX: wall.x - halfWidth,
    maxX: wall.x + halfWidth,
    minZ: wall.z - halfDepth,
    maxZ: wall.z + halfDepth,
  }
}
