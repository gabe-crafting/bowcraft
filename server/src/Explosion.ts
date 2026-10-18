let nextExplosionId = 1

export class Explosion {
  readonly id: string

  constructor(
    readonly ownerId: string,
    readonly x: number,
    readonly z: number,
    readonly radius: number,
    readonly bornMs: number,
  ) {
    this.id = `e${nextExplosionId}`
    nextExplosionId += 1
  }
}
