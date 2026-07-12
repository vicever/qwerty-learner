import { Button } from '@/components/ui/button'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import {
  checkDataIntegrity,
  downloadBackup,
  exportData,
  fixDataIntegrity,
  getLocalBackup,
  getLocalBackupVersions,
  importData,
  type BackupData,
} from '@/utils/db/backup'
import { useState } from 'react'

const DataManager = () => {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [integrityResult, setIntegrityResult] = useState<{
    valid: boolean
    issues: string[]
    stats: {
      accounts: number
      wordRecords: number
      chapterRecords: number
      reviewRecords: number
      fsrsCards: number
    }
  } | null>(null)
  const [localBackups, setLocalBackups] = useState<string[]>([])

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportData()
      downloadBackup()
      showMessage('数据导出成功，文件已下载', 'success')
    } catch (error) {
      showMessage(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const backup: BackupData = JSON.parse(text)
      const result = await importData(backup)
      if (result.success) {
        showMessage(result.message, 'success')
        setTimeout(() => window.location.reload(), 2000)
      } else {
        showMessage(result.message, 'error')
      }
    } catch (error) {
      showMessage(`导入失败: ${error instanceof Error ? error.message : '文件格式错误'}`, 'error')
    } finally {
      setIsImporting(false)
      event.target.value = ''
    }
  }

  const handleCheckIntegrity = async () => {
    setIsChecking(true)
    try {
      const result = await checkDataIntegrity()
      setIntegrityResult(result)
      if (result.valid) {
        showMessage('数据完整性检查通过', 'success')
      } else {
        showMessage(`数据存在 ${result.issues.length} 个问题`, 'error')
      }
    } catch (error) {
      showMessage(`检查失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setIsChecking(false)
    }
  }

  const handleFixIntegrity = async () => {
    setIsFixing(true)
    try {
      const result = await fixDataIntegrity()
      if (result.success) {
        showMessage(result.message, 'success')
        handleCheckIntegrity()
      } else {
        showMessage(result.message, 'error')
      }
    } catch (error) {
      showMessage(`修复失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setIsFixing(false)
    }
  }

  const handleRestoreBackup = async (version: string) => {
    const backup = getLocalBackup(version)
    if (!backup) {
      showMessage('备份数据不存在', 'error')
      return
    }

    if (!window.confirm(`确定要恢复版本 ${version} 的备份吗？当前数据将被覆盖。`)) {
      return
    }

    setIsImporting(true)
    try {
      const result = await importData(backup)
      if (result.success) {
        showMessage(result.message, 'success')
        setTimeout(() => window.location.reload(), 2000)
      } else {
        showMessage(result.message, 'error')
      }
    } catch (error) {
      showMessage(`恢复失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setIsImporting(false)
    }
  }

  const loadLocalBackups = () => {
    setLocalBackups(getLocalBackupVersions())
  }

  if (!integrityResult) {
    handleCheckIntegrity()
    loadLocalBackups()
  }

  return (
    <Layout>
      <Header>
        <button
          className="rounded-lg bg-indigo-400 px-6 py-1 text-lg text-white focus:outline-none dark:text-opacity-80"
          onClick={() => window.history.back()}
        >
          返回
        </button>
      </Header>
      <div className="container mx-auto flex w-full flex-1 flex-col items-center justify-center px-6 pb-10">
        <h1 className="mb-8 text-3xl font-bold text-indigo-500 dark:text-indigo-400">数据管理</h1>

        {message && (
          <div
            className={`mb-6 w-full max-w-3xl rounded-lg p-4 text-center ${
              messageType === 'success'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : messageType === 'error'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`}
          >
            {message}
          </div>
        )}

        <div className="w-full max-w-3xl space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-700 dark:bg-opacity-50">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">数据统计</h2>
            {integrityResult && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="flex flex-col items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-300">账户</span>
                  <span className="mt-2 text-3xl font-bold text-indigo-500 dark:text-indigo-400">
                    {integrityResult.stats.accounts}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-300">单词记录</span>
                  <span className="mt-2 text-3xl font-bold text-gray-700 dark:text-gray-200">
                    {integrityResult.stats.wordRecords}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-300">章节记录</span>
                  <span className="mt-2 text-3xl font-bold text-gray-700 dark:text-gray-200">
                    {integrityResult.stats.chapterRecords}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-300">复习记录</span>
                  <span className="mt-2 text-3xl font-bold text-gray-700 dark:text-gray-200">
                    {integrityResult.stats.reviewRecords}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-300">FSRS卡片</span>
                  <span className="mt-2 text-3xl font-bold text-gray-700 dark:text-gray-200">
                    {integrityResult.stats.fsrsCards}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-700 dark:bg-opacity-50">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">数据备份</h2>
            <div className="flex flex-wrap gap-4">
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? '导出中...' : '导出数据'}
              </Button>
              <label className="flex items-center justify-center rounded-md bg-indigo-500 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-600">
                <span>{isImporting ? '导入中...' : '导入数据'}</span>
                <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={isImporting} />
              </label>
            </div>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              备份文件包含所有学习进度、错题记录和设置，建议定期导出保存。
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-700 dark:bg-opacity-50">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">本地备份</h2>
            {localBackups.length > 0 ? (
              <div className="space-y-2">
                {localBackups.map((version) => {
                  const backup = getLocalBackup(version)
                  return (
                    <div
                      key={version}
                      className="flex items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-600"
                    >
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-200">版本 {version}</span>
                        {backup && (
                          <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(backup.exportTime).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <Button size="sm" onClick={() => handleRestoreBackup(version)}>
                        恢复
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">暂无本地自动备份</p>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-700 dark:bg-opacity-50">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">数据完整性</h2>
            {integrityResult && (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">状态:</span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      integrityResult.valid
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {integrityResult.valid ? '正常' : '存在问题'}
                  </span>
                </div>
                {integrityResult.issues.length > 0 && (
                  <div className="mb-4 space-y-1">
                    {integrityResult.issues.map((issue, index) => (
                      <p key={index} className="text-sm text-red-600 dark:text-red-400">
                        • {issue}
                      </p>
                    ))}
                  </div>
                )}
                <div className="flex gap-4">
                  <Button variant="outline" onClick={handleCheckIntegrity} disabled={isChecking}>
                    {isChecking ? '检查中...' : '检查完整性'}
                  </Button>
                  <Button variant="outline" onClick={handleFixIntegrity} disabled={isFixing || integrityResult.valid}>
                    {isFixing ? '修复中...' : '修复问题'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default DataManager
