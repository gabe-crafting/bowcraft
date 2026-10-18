import { DUMMY_HP } from '@bounty/shared'

let nextDummyId = 1

export class Dummy {
  readonly id: string
  hp = DUMMY_HP
  alive = true

  constructor(
    readonly x: number,
    readonly z: number,
  ) {
    this.id = `d${nextDummyId}`
    nextDummyId += 1
  }
}
