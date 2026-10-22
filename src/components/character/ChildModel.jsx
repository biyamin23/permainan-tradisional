import { GENDERS } from '../../state/playerState'
import { PersonModel } from './PersonModel'

/** The player's kid, in the two looks chosen at character creation. */
export const CHILD_LOOKS = {
  [GENDERS.LELAKI]: {
    shirt: '#2b9aa0',
    bottom: '#4b3a2c',
    bottomType: 'shorts',
    hair: '#21140d',
    slipper: '#2f6fd1',
    accent: '#f2c14e',
  },
  [GENDERS.PEREMPUAN]: {
    shirt: '#e9779a',
    bottom: '#c2527a',
    bottomType: 'kain',
    hair: '#26160f',
    hairStyle: 'pigtails',
    slipper: '#d9473b',
    accent: '#ffd54f',
  },
}

export function ChildModel({ gender = GENDERS.LELAKI, motionRef, pose = 'idle' }) {
  return <PersonModel build="kid" look={CHILD_LOOKS[gender] ?? CHILD_LOOKS[GENDERS.LELAKI]} motionRef={motionRef} pose={pose} />
}
