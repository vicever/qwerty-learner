import type { IAccount } from './account'
import { accountDB } from './account'
import type { IFsrsCardRecord } from './index'
import { db } from './index'

export interface BackupData {
  version: string
  exportTime: number
  appVersion: string
  accounts: IAccount[]
  wordRecords: unknown[]
  chapterRecords: unknown[]
  reviewRecords: unknown[]
  fsrsCards: IFsrsCardRecord[]
  localStorage: Record<string, string>
}

const APP_VERSION_KEY = 'kuku_backup_version'

export async function exportData(): Promise<BackupData> {
  const accounts = await accountDB.accounts.toArray()
  const wordRecords = await db.wordRecords.toArray()
  const chapterRecords = await db.chapterRecords.toArray()
  const reviewRecords = await db.reviewRecords.toArray()
  const fsrsCards = await db.fsrsCards.toArray()

  const localStorageData: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      localStorageData[key] = localStorage.getItem(key) || ''
    }
  }

  return {
    version: getAppVersion(),
    exportTime: Date.now(),
    appVersion: getAppVersion(),
    accounts,
    wordRecords,
    chapterRecords,
    reviewRecords,
    fsrsCards,
    localStorage: localStorageData,
  }
}

export async function importData(backup: BackupData): Promise<{ success: boolean; message: string }> {
  try {
    await db.transaction('rw', db.wordRecords, db.chapterRecords, db.reviewRecords, db.fsrsCards, async () => {
      await db.wordRecords.clear()
      await db.chapterRecords.clear()
      await db.reviewRecords.clear()
      await db.fsrsCards.clear()

      if (backup.wordRecords.length > 0) {
        await db.wordRecords.bulkAdd(backup.wordRecords)
      }
      if (backup.chapterRecords.length > 0) {
        await db.chapterRecords.bulkAdd(backup.chapterRecords)
      }
      if (backup.reviewRecords.length > 0) {
        await db.reviewRecords.bulkAdd(backup.reviewRecords)
      }
      if (backup.fsrsCards.length > 0) {
        await db.fsrsCards.bulkAdd(backup.fsrsCards)
      }
    })

    await accountDB.transaction('rw', accountDB.accounts, async () => {
      await accountDB.accounts.clear()
      if (backup.accounts.length > 0) {
        await accountDB.accounts.bulkAdd(backup.accounts)
      }
    })

    for (const [key, value] of Object.entries(backup.localStorage)) {
      localStorage.setItem(key, value)
    }

    return { success: true, message: '数据恢复成功' }
  } catch (error) {
    console.error('数据导入失败:', error)
    return { success: false, message: `数据导入失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}

export async function autoBackupOnVersionUpgrade(): Promise<void> {
  const currentVersion = getAppVersion()
  const lastBackupVersion = localStorage.getItem(APP_VERSION_KEY)

  if (lastBackupVersion !== currentVersion) {
    try {
      const backup = await exportData()
      localStorage.setItem(`kuku_backup_${lastBackupVersion || 'pre_v1'}`, JSON.stringify(backup))
      localStorage.setItem(APP_VERSION_KEY, currentVersion)
      console.log(`版本升级自动备份完成: ${lastBackupVersion || 'pre_v1'} -> ${currentVersion}`)
    } catch (error) {
      console.error('版本升级自动备份失败:', error)
    }
  }
}

export async function checkDataIntegrity(): Promise<{
  valid: boolean
  issues: string[]
  stats: {
    accounts: number
    wordRecords: number
    chapterRecords: number
    reviewRecords: number
    fsrsCards: number
  }
}> {
  const issues: string[] = []

  const accounts = await accountDB.accounts.toArray()
  const wordRecords = await db.wordRecords.toArray()
  const chapterRecords = await db.chapterRecords.toArray()
  const reviewRecords = await db.reviewRecords.toArray()
  const fsrsCards = await db.fsrsCards.toArray()

  if (accounts.length === 0) {
    issues.push('未找到账户数据')
  }

  const hasDefaultAccount = accounts.some((acc) => acc.id === 'default')
  if (!hasDefaultAccount && accounts.length > 0) {
    issues.push('缺少默认账户')
  }

  for (const record of wordRecords) {
    if (!(record as Record<string, unknown>).accountId) {
      issues.push('存在缺少 accountId 的单词记录')
      break
    }
  }

  for (const card of fsrsCards) {
    if (!card.accountId || !card.word || !card.dict) {
      issues.push('存在不完整的 FSRS 卡片记录')
      break
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    stats: {
      accounts: accounts.length,
      wordRecords: wordRecords.length,
      chapterRecords: chapterRecords.length,
      reviewRecords: reviewRecords.length,
      fsrsCards: fsrsCards.length,
    },
  }
}

export async function fixDataIntegrity(): Promise<{ success: boolean; fixed: number; message: string }> {
  let fixed = 0

  try {
    const accounts = await accountDB.accounts.toArray()
    if (accounts.length === 0) {
      await accountDB.accounts.put({
        id: 'default',
        name: '默认账户',
        createdAt: Date.now(),
      })
      fixed++
    } else {
      const hasDefault = accounts.some((acc) => acc.id === 'default')
      if (!hasDefault) {
        await accountDB.accounts.put({
          id: 'default',
          name: '默认账户',
          createdAt: Date.now(),
        })
        fixed++
      }
    }

    const wordRecords = await db.wordRecords.toArray()
    const recordsToFix = wordRecords.filter((r) => !(r as Record<string, unknown>).accountId)
    if (recordsToFix.length > 0) {
      for (const record of recordsToFix) {
        ;(record as Record<string, unknown>).accountId = 'default'
      }
      await db.wordRecords.bulkPut(wordRecords)
      fixed += recordsToFix.length
    }

    const fsrsCards = await db.fsrsCards.toArray()
    const cardsToDelete = fsrsCards.filter((c) => !c.accountId || !c.word || !c.dict)
    if (cardsToDelete.length > 0) {
      for (const card of cardsToDelete) {
        if (card.id) await db.fsrsCards.delete(card.id)
      }
      fixed += cardsToDelete.length
    }

    return { success: true, fixed, message: `修复完成，共修复 ${fixed} 条记录` }
  } catch (error) {
    console.error('数据修复失败:', error)
    return { success: false, fixed: 0, message: `修复失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}

export function downloadBackup(): void {
  exportData().then((backup) => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kuku-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  })
}

export function getAppVersion(): string {
  return '1.0'
}

export function getLocalBackupVersions(): string[] {
  const versions: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('kuku_backup_')) {
      versions.push(key.replace('kuku_backup_', ''))
    }
  }
  return versions.sort()
}

export function getLocalBackup(version: string): BackupData | null {
  const data = localStorage.getItem(`kuku_backup_${version}`)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export interface BackupComparison {
  isNewer: boolean
  isOlder: boolean
  isSame: boolean
  localTime: number
  backupTime: number
  timeDiff: number
  localStats: {
    accounts: number
    wordRecords: number
    chapterRecords: number
    reviewRecords: number
    fsrsCards: number
  }
  backupStats: {
    accounts: number
    wordRecords: number
    chapterRecords: number
    reviewRecords: number
    fsrsCards: number
  }
  appVersionMatch: boolean
  localAppVersion: string
  backupAppVersion: string
}

export async function compareBackup(backup: BackupData): Promise<BackupComparison> {
  const localStats = (await checkDataIntegrity()).stats
  const localTime = localStorage.getItem('kuku_last_update_time')
  const localTimeNum = localTime ? parseInt(localTime, 10) : 0
  const backupTime = backup.exportTime || 0

  const localAppVersion = getAppVersion()
  const backupAppVersion = backup.appVersion || 'unknown'

  const timeDiff = backupTime - localTimeNum

  return {
    isNewer: timeDiff > 0,
    isOlder: timeDiff < 0,
    isSame: timeDiff === 0,
    localTime: localTimeNum,
    backupTime,
    timeDiff,
    localStats,
    backupStats: {
      accounts: backup.accounts.length,
      wordRecords: backup.wordRecords.length,
      chapterRecords: backup.chapterRecords.length,
      reviewRecords: backup.reviewRecords.length,
      fsrsCards: backup.fsrsCards.length,
    },
    appVersionMatch: localAppVersion === backupAppVersion,
    localAppVersion,
    backupAppVersion,
  }
}

export function recordLastUpdateTime(): void {
  localStorage.setItem('kuku_last_update_time', Date.now().toString())
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return new Date(timestamp).toLocaleDateString()
}
