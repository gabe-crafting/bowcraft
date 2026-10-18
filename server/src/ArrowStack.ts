import type { ArrowKind } from '@bounty/shared'

let nextStackId = 1

export class ArrowStack {
  readonly id: string

  constructor(
    readonly kind: ArrowKind,
    readonly x: number,
    readonly z: number,
    readonly count: number,
  ) {
    this.id = `a${nextStackId}`
    nextStackId += 1
  }
}
