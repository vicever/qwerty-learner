import { atomWithStorage } from 'jotai/utils'

export type PracticeMode = 'word' | 'sentence'

export const practiceModeAtom = atomWithStorage<PracticeMode>('practiceMode', 'word')
