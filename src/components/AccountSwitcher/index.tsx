import Tooltip from '@/components/Tooltip'
import { currentAccountIdAtom, currentAccountNameAtom } from '@/store'
import { createAccount, deleteAccount, getAllAccounts, renameAccount } from '@/utils/db/account'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAtom } from 'jotai'
import { useEffect, useState } from 'react'
import IconUser from '~icons/heroicons/user-circle-solid'
import IconPlus from '~icons/heroicons/plus-solid'
import IconTrash from '~icons/heroicons/trash-solid'
import IconPencil from '~icons/heroicons/pencil-square-solid'

export default function AccountSwitcher() {
  const [currentAccountId, setCurrentAccountId] = useAtom(currentAccountIdAtom)
  const [, setCurrentAccountName] = useAtom(currentAccountNameAtom)
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; createdAt: number }>>([])
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const refreshAccounts = async () => {
    const list = await getAllAccounts()
    setAccounts(list)
    const current = list.find((a) => a.id === currentAccountId)
    if (current) {
      setCurrentAccountName(current.name)
    } else if (list.length > 0) {
      setCurrentAccountId(list[0].id)
      setCurrentAccountName(list[0].name)
    }
  }

  useEffect(() => {
    refreshAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccountId])

  const switchAccount = (id: string, name: string) => {
    setCurrentAccountId(id)
    setCurrentAccountName(name)
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const account = await createAccount(name)
    setNewName('')
    await refreshAccounts()
    switchAccount(account.id, account.name)
  }

  const handleRename = async (id: string) => {
    const name = editingName.trim()
    if (!name) return
    await renameAccount(id, name)
    setEditingId(null)
    setEditingName('')
    await refreshAccounts()
  }

  const handleDelete = async (id: string) => {
    if (id === currentAccountId) return
    await deleteAccount(id)
    await refreshAccounts()
  }

  const currentAccount = accounts.find((a) => a.id === currentAccountId)

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-indigo-500 hover:bg-indigo-50 dark:hover:bg-gray-700 focus:outline-none"
            type="button"
            aria-label="切换账户"
          >
            <IconUser className="h-5 w-5" />
            <span className="max-w-[80px] truncate">{currentAccount?.name ?? '账户'}</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-50 min-w-[180px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {accounts.map((account) => (
              <DropdownMenu.Item
                key={account.id}
                onSelect={() => switchAccount(account.id, account.name)}
                className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm ${
                  account.id === currentAccountId
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-gray-700 dark:text-indigo-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <span className="truncate">{account.name}</span>
                {account.id === currentAccountId && <span className="text-xs">✓</span>}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
            <DropdownMenu.Item
              onSelect={() => setIsManageOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <IconPlus className="h-4 w-4" />
              管理账户
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog.Root open={isManageOpen} onOpenChange={setIsManageOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <Dialog.Title className="mb-4 text-lg font-bold text-gray-800 dark:text-gray-200">账户管理</Dialog.Title>

            {/* 新建账户 */}
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="新账户名称"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              />
              <button
                onClick={handleCreate}
                className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm text-white hover:bg-indigo-600"
                type="button"
              >
                添加
              </button>
            </div>

            {/* 账户列表 */}
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    account.id === currentAccountId
                      ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-gray-700'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {editingId === account.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(account.id)
                        if (e.key === 'Escape') {
                          setEditingId(null)
                          setEditingName('')
                        }
                      }}
                      autoFocus
                      className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    />
                  ) : (
                    <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
                      {account.name}
                      {account.id === currentAccountId && <span className="ml-2 text-xs text-indigo-500">当前</span>}
                    </span>
                  )}
                  <div className="flex gap-1">
                    {editingId === account.id ? (
                      <button onClick={() => handleRename(account.id)} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-gray-700" type="button">
                        ✓
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(account.id)
                          setEditingName(account.name)
                        }}
                        className="p-1 text-gray-400 hover:text-indigo-500"
                        type="button"
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                    )}
                    {account.id !== 'default' && account.id !== currentAccountId && (
                      <button onClick={() => handleDelete(account.id)} className="p-1 text-gray-400 hover:text-red-500" type="button">
                        <IconTrash className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-gray-400">每个账户的练习进度、复习记录相互独立，无需登录。</div>

            <Dialog.Close asChild>
              <button className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600" type="button">
                关闭
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
