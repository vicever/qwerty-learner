import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface IAccount {
  id: string
  name: string
  createdAt: number
  avatar?: string
}

class AccountDB extends Dexie {
  accounts!: Table<IAccount, string>

  constructor() {
    super('AccountDB')
    this.version(1).stores({
      accounts: 'id, name, createdAt',
    })
  }
}

export const accountDB = new AccountDB()

export const DEFAULT_ACCOUNT_ID = 'default'
export const DEFAULT_ACCOUNT: IAccount = {
  id: DEFAULT_ACCOUNT_ID,
  name: '默认账户',
  createdAt: Date.now(),
}

export async function ensureDefaultAccount() {
  const existing = await accountDB.accounts.get(DEFAULT_ACCOUNT_ID)
  if (!existing) {
    await accountDB.accounts.put(DEFAULT_ACCOUNT)
  }
}

export async function getAllAccounts() {
  await ensureDefaultAccount()
  return accountDB.accounts.orderBy('createdAt').toArray()
}

export async function createAccount(name: string) {
  const id = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const account: IAccount = { id, name, createdAt: Date.now() }
  await accountDB.accounts.put(account)
  return account
}

export async function renameAccount(id: string, name: string) {
  await accountDB.accounts.update(id, { name })
}

export async function deleteAccount(id: string) {
  if (id === DEFAULT_ACCOUNT_ID) return
  await accountDB.accounts.delete(id)
}
