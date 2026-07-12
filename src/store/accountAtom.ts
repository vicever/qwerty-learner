import { DEFAULT_ACCOUNT_ID, ensureDefaultAccount } from '@/utils/db/account'
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export const currentAccountIdAtom = atomWithStorage('currentAccountId', DEFAULT_ACCOUNT_ID)

export const currentAccountNameAtom = atom<string>('默认账户')

export const accountsAtom = atom<{ list: Array<{ id: string; name: string; createdAt: number }>; loaded: boolean }>({
  list: [],
  loaded: false,
})

export async function initAccount() {
  await ensureDefaultAccount()
}
