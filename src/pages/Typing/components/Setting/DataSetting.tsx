import styles from './index.module.css'
import type { ExportProgress, ImportProgress } from '@/utils/db/data-export'
import { exportDatabase, importDatabase } from '@/utils/db/data-export'
import * as Progress from '@radix-ui/react-progress'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'

export default function DataSetting() {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  const exportProgressCallback = useCallback(({ totalRows, completedRows, done }: ExportProgress) => {
    if (done) {
      setIsExporting(false)
      setExportProgress(100)
      return true
    }
    if (totalRows) {
      setExportProgress(Math.floor((completedRows / totalRows) * 100))
    }

    return true
  }, [])

  const onClickExport = useCallback(() => {
    setExportProgress(0)
    setIsExporting(true)
    exportDatabase(exportProgressCallback)
  }, [exportProgressCallback])

  const importProgressCallback = useCallback(({ totalRows, completedRows, done }: ImportProgress) => {
    if (done) {
      setIsImporting(false)
      setImportProgress(100)
      return true
    }
    if (totalRows) {
      setImportProgress(Math.floor((completedRows / totalRows) * 100))
    }

    return true
  }, [])

  const onStartImport = useCallback(() => {
    setImportProgress(0)
    setIsImporting(true)
  }, [])

  const onClickImport = useCallback(() => {
    importDatabase(onStartImport, importProgressCallback)
  }, [importProgressCallback, onStartImport])

  return (
    <ScrollArea.Root className="flex-1 select-none overflow-y-auto ">
      <ScrollArea.Viewport className="h-full w-full px-3">
        <div className={styles.tabContent}>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>数据导出</span>
            <span className={styles.sectionDescription}>
              将当前设备的所有数据（账户、单词记录、复习进度、设置配置）导出为压缩文件。
              导出的文件包含时间戳和版本信息，便于多设备同步时进行比对。
            </span>
            <span className="pl-4 text-left text-sm font-bold leading-tight text-red-500">
              为了您的数据安全，请不要修改导出的数据文件。
            </span>
            <div className="flex h-3 w-full items-center justify-start px-5">
              <Progress.Root
                className="translate-z-0 relative h-2 w-11/12 transform  overflow-hidden rounded-full bg-gray-200"
                value={exportProgress}
              >
                <Progress.Indicator
                  className="cubic-bezier(0.65, 0, 0.35, 1) h-full w-full bg-indigo-400 transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${100 - exportProgress}%)` }}
                />
              </Progress.Root>
              <span className="ml-4 w-10 text-xs font-normal text-gray-600">{`${exportProgress}%`}</span>
            </div>

            <button
              className="my-btn-primary ml-4 disabled:bg-gray-300"
              type="button"
              onClick={onClickExport}
              disabled={isExporting}
              title="导出数据"
            >
              导出数据
            </button>
          </div>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>数据导入</span>
            <span className={styles.sectionDescription}>
              从导出的文件中恢复数据。导入前请确保：
            </span>
            <ul className="pl-8 text-left text-sm text-gray-600">
              <li>• 已备份当前设备的数据</li>
              <li>• 导入文件是从最新版本导出的</li>
              <li>• 确认文件未被修改或损坏</li>
            </ul>
            <span className="pl-4 text-left text-sm font-bold leading-tight text-red-500">
              请注意，导入数据将<strong className="text-sm font-bold text-red-500"> 完全覆盖 </strong>当前数据。请谨慎操作。
            </span>

            <div className="flex h-3 w-full items-center justify-start px-5">
              <Progress.Root
                className="translate-z-0 relative h-2 w-11/12 transform  overflow-hidden rounded-full bg-gray-200"
                value={importProgress}
              >
                <Progress.Indicator
                  className="cubic-bezier(0.65, 0, 0.35, 1) h-full w-full bg-indigo-400 transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${100 - importProgress}%)` }}
                />
              </Progress.Root>
              <span className="ml-4 w-10 text-xs font-normal text-gray-600">{`${importProgress}%`}</span>
            </div>

            <button
              className="my-btn-primary ml-4 disabled:bg-gray-300"
              type="button"
              onClick={onClickImport}
              disabled={isImporting}
              title="导入数据"
            >
              导入数据
            </button>
          </div>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>多设备同步指南</span>
            <span className={styles.sectionDescription}>
              您可以通过以下步骤在不同设备间同步数据：
            </span>
            <div className="pl-6 pt-2">
              <div className="mb-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">1</span>
                <span className="ml-2 text-sm">在源设备上点击「导出数据」，下载备份文件</span>
              </div>
              <div className="mb-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">2</span>
                <span className="ml-2 text-sm">通过 AirDrop、微信、邮件等方式将文件发送到目标设备</span>
              </div>
              <div className="mb-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">3</span>
                <span className="ml-2 text-sm">在目标设备上点击「导入数据」，选择发送的备份文件</span>
              </div>
              <div className="mb-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">4</span>
                <span className="ml-2 text-sm">等待导入完成，刷新页面即可使用同步后的数据</span>
              </div>
            </div>
            <div className="mt-3 rounded bg-yellow-50 p-3 text-xs text-yellow-700">
              <strong>提示：</strong>建议在使用新设备前先导出旧设备数据，避免数据丢失。
              导出文件包含时间戳，导入时可以确认数据版本是否最新。
            </div>
          </div>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>高级数据管理</span>
            <span className={styles.sectionDescription}>
              管理本地备份、检查数据完整性、查看详细数据统计。
            </span>
            <Link
              to="/data-manager"
              className="ml-4 inline-block rounded bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-600"
            >
              进入数据管理
            </Link>
          </div>
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent " orientation="vertical"></ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}
