import { currentAccountIdAtom } from '@/store'
import { db, getFsrsCardStats } from '@/utils/db'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IconClock from '~icons/heroicons/clock-solid'
import IconFire from '~icons/heroicons/fire-solid'
import IconChart from '~icons/heroicons/chart-bar-solid'
import IconArrowRight from '~icons/heroicons/arrow-right-solid'

interface TodayStats {
  todayDuration: number // 秒
  todayWordCount: number
  dueCount: number
  efficiencyDelta: number // 百分比，正为提升
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  const min = Math.floor(seconds / 60)
  if (min < 60) return `${min} 分钟`
  const h = Math.floor(min / 60)
  const restMin = min % 60
  return `${h} 小时 ${restMin} 分钟`
}

export default function TodayCard() {
  const accountId = useAtomValue(currentAccountIdAtom)
  const navigate = useNavigate()
  const [stats, setStats] = useState<TodayStats | undefined>(undefined)

  useEffect(() => {
    const loadStats = async () => {
      // 今日时间范围
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const endOfToday = startOfToday + 86400000

      // 7 天前用于对比
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const startOfSevenDaysAgo = new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate()).getTime()

      // 查询今日章节记录
      const todayRecords = (await db.chapterRecords.where('timeStamp').between(startOfToday, endOfToday).toArray()).filter(
        (r) => r.accountId === accountId,
      )
      const todayDuration = todayRecords.reduce((sum, r) => sum + r.time, 0)
      const todayWordCount = todayRecords.reduce((sum, r) => sum + r.wordCount, 0)

      // 查询 7 天前同一天的记录用于对比
      const sevenDaysAgoRecords = (await db.chapterRecords.where('timeStamp').between(startOfSevenDaysAgo, startOfSevenDaysAgo + 86400000).toArray()).filter(
        (r) => r.accountId === accountId,
      )
      const sevenDaysAgoDuration = sevenDaysAgoRecords.reduce((sum, r) => sum + r.time, 0)

      let efficiencyDelta = 0
      if (sevenDaysAgoDuration > 0 && todayDuration > 0) {
        // 用 WPM 对比作为效率指标
        const todayWpm = todayDuration > 0 ? todayWordCount / (todayDuration / 60) : 0
        const sevenDaysAgoWpm = sevenDaysAgoDuration > 0 ? sevenDaysAgoRecords.reduce((s, r) => s + r.wordCount, 0) / (sevenDaysAgoDuration / 60) : 0
        if (sevenDaysAgoWpm > 0) {
          efficiencyDelta = Math.round(((todayWpm - sevenDaysAgoWpm) / sevenDaysAgoWpm) * 100)
        }
      }

      // FSRS 到期数
      const fsrsStats = await getFsrsCardStats(accountId)

      setStats({
        todayDuration,
        todayWordCount,
        dueCount: fsrsStats.dueCount,
        efficiencyDelta,
      })
    }
    loadStats()
    const interval = setInterval(loadStats, 60000)
    return () => clearInterval(interval)
  }, [accountId])

  if (!stats) return null

  return (
    <div className="mb-4 flex w-full max-w-3xl flex-wrap items-center justify-center gap-3">
      {/* 今日手感 */}
      <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm dark:bg-gray-800">
        <IconClock className="h-5 w-5 text-indigo-400" />
        <div>
          <div className="text-xs text-gray-400">今日手感</div>
          <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{formatDuration(stats.todayDuration)}</div>
        </div>
      </div>

      {/* 今日词数 */}
      <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm dark:bg-gray-800">
        <IconFire className="h-5 w-5 text-orange-400" />
        <div>
          <div className="text-xs text-gray-400">今日词数</div>
          <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{stats.todayWordCount}</div>
        </div>
      </div>

      {/* 待复习 */}
      <button
        type="button"
        onClick={() => navigate('/review')}
        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm transition hover:shadow-md dark:bg-gray-800"
      >
        <IconChart className="h-5 w-5 text-green-400" />
        <div className="text-left">
          <div className="text-xs text-gray-400">待复习</div>
          <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{stats.dueCount} 词</div>
        </div>
        <IconArrowRight className="h-4 w-4 text-gray-300" />
      </button>

      {/* 效率提升 */}
      {stats.efficiencyDelta !== 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm dark:bg-gray-800">
          <div>
            <div className="text-xs text-gray-400">效率变化</div>
            <div className={`text-sm font-bold ${stats.efficiencyDelta > 0 ? 'text-green-500' : 'text-orange-500'}`}>
              {stats.efficiencyDelta > 0 ? '+' : ''}
              {stats.efficiencyDelta}%
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
