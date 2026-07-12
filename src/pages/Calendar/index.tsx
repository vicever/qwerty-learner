import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { currentAccountIdAtom } from '@/store'
import { db } from '@/utils/db'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/** 单日学习统计 */
interface DayStats {
  /** 当地日期对象（用于展示） */
  date: Date
  /** 新学单词数（chapter >= 0 的章节记录数） */
  newWordsCount: number
  /** 复习章节数（chapter === -1 的记录数） */
  reviewCount: number
  /** 当日新增错词数（wordRecords 中 wrongCount > 0 的记录数） */
  wrongWordsCount: number
  /** 当日总耗时（秒） */
  totalTime: number
}

/** 日期键：YYYY-M-D（使用本地日期组件） */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** 判断两个日期是否同一天（基于本地日期组件） */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** 将秒数格式化为 Xh Ym 或 Xs */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = Math.round(seconds % 60)
  if (minutes < 60) return remainSeconds > 0 ? `${minutes}分${remainSeconds}秒` : `${minutes}分`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return remainMinutes > 0 ? `${hours}时${remainMinutes}分` : `${hours}时`
}

const WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const Calendar = () => {
  const navigate = useNavigate()
  const accountId = useAtomValue(currentAccountIdAtom)

  // 当前查看的月份（指向该月第一天）
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [dayStats, setDayStats] = useState<Map<string, DayStats>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<DayStats | null>(null)

  // 加载指定月份的数据
  const loadMonthData = useCallback(async () => {
    if (!accountId) {
      setDayStats(new Map())
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      // 本地月初 / 下月初（getTime 返回 UTC 毫秒，除以 1000 得到秒级时间戳，与记录存储一致）
      const startSeconds = Math.floor(new Date(year, month, 1).getTime() / 1000)
      const endSeconds = Math.floor(new Date(year, month + 1, 1).getTime() / 1000)

      // 查询当月章节记录并按账户过滤
      const chapterRecords = await db.chapterRecords.where('timeStamp').between(startSeconds, endSeconds, true, false).toArray()
      const myChapters = chapterRecords.filter((r) => r.accountId === accountId)

      // 查询当月单词记录并按账户过滤（用于统计错词）
      const wordRecords = await db.wordRecords.where('timeStamp').between(startSeconds, endSeconds, true, false).toArray()
      const myWords = wordRecords.filter((r) => r.accountId === accountId)

      // 按日期分组统计
      const statsMap = new Map<string, DayStats>()

      const ensureDay = (d: Date): DayStats => {
        const key = dateKey(d)
        let stats = statsMap.get(key)
        if (!stats) {
          stats = {
            date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
            newWordsCount: 0,
            reviewCount: 0,
            wrongWordsCount: 0,
            totalTime: 0,
          }
          statsMap.set(key, stats)
        }
        return stats
      }

      // 统计章节记录
      for (const rec of myChapters) {
        const d = new Date(rec.timeStamp * 1000)
        const stats = ensureDay(d)
        if (rec.chapter === -1) {
          stats.reviewCount += 1
        } else if (rec.chapter != null && rec.chapter >= 0) {
          stats.newWordsCount += 1
        }
        stats.totalTime += rec.time ?? 0
      }

      // 统计错词（当日 wordRecords 中 wrongCount > 0 的记录数）
      for (const rec of myWords) {
        if (rec.wrongCount > 0) {
          const d = new Date(rec.timeStamp * 1000)
          const stats = ensureDay(d)
          stats.wrongWordsCount += 1
        }
      }

      setDayStats(statsMap)
    } catch (e) {
      console.error('加载日历数据失败:', e)
      setDayStats(new Map())
    } finally {
      setLoading(false)
    }
  }, [accountId, currentMonth])

  useEffect(() => {
    loadMonthData()
  }, [loadMonthData])

  // 月份切换
  const prevMonth = () => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    setCurrentMonth(d)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    setCurrentMonth(d)
    setSelectedDay(null)
  }
  const goToday = () => {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDay(null)
  }

  // 生成日历网格：从本月第一天所在的周日开始，填满完整周
  const gridDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const startWeekday = firstDay.getDay() // 0=周日
    const startDate = new Date(year, month, 1 - startWeekday)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7
    const cells: Date[] = []
    for (let i = 0; i < totalCells; i++) {
      cells.push(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i))
    }
    return cells
  }, [currentMonth])

  // 当月最大学习量（用于背景深浅归一化）
  const maxLearnCount = useMemo(() => {
    let max = 0
    dayStats.forEach((stats) => {
      const total = stats.newWordsCount + stats.reviewCount
      if (total > max) max = total
    })
    return max
  }, [dayStats])

  // 当月汇总统计
  const monthSummary = useMemo(() => {
    let learnDays = 0
    let totalNew = 0
    let totalReview = 0
    let totalWrong = 0
    let totalTime = 0
    dayStats.forEach((stats) => {
      if (stats.newWordsCount + stats.reviewCount > 0) learnDays += 1
      totalNew += stats.newWordsCount
      totalReview += stats.reviewCount
      totalWrong += stats.wrongWordsCount
      totalTime += stats.totalTime
    })
    return { learnDays, totalNew, totalReview, totalWrong, totalTime }
  }, [dayStats])

  // 根据学习量计算背景色深浅（indigo 色，使用透明度适配明暗模式）
  const getIntensityClass = (count: number): string => {
    if (count <= 0 || maxLearnCount <= 0) return ''
    const ratio = count / maxLearnCount
    if (ratio > 0.75) return 'bg-indigo-500/60'
    if (ratio > 0.5) return 'bg-indigo-500/45'
    if (ratio > 0.25) return 'bg-indigo-500/30'
    return 'bg-indigo-500/15'
  }

  const today = new Date()
  const yearLabel = currentMonth.getFullYear()
  const monthLabel = currentMonth.getMonth() + 1

  return (
    <Layout>
      <Header>
        <button
          className="rounded-lg bg-indigo-400 px-6 py-1 text-lg text-white focus:outline-none dark:text-opacity-80"
          onClick={() => navigate('/')}
        >
          返回
        </button>
      </Header>
      <div className="container mx-auto flex w-full flex-1 flex-col items-center px-6 pb-10">
        <h1 className="mb-6 text-3xl font-bold text-indigo-500 dark:text-indigo-400">学习日历</h1>

        {/* 月份切换 */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="rounded-lg bg-white px-4 py-2 text-gray-600 shadow-sm transition-colors hover:bg-indigo-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            type="button"
            aria-label="上一月"
          >
            ←
          </button>
          <span className="min-w-[140px] text-center text-xl font-semibold text-gray-700 dark:text-gray-200">
            {yearLabel}年{monthLabel}月
          </span>
          <button
            onClick={nextMonth}
            className="rounded-lg bg-white px-4 py-2 text-gray-600 shadow-sm transition-colors hover:bg-indigo-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            type="button"
            aria-label="下一月"
          >
            →
          </button>
          <button
            onClick={goToday}
            className="ml-2 rounded-lg bg-indigo-100 px-3 py-2 text-sm text-indigo-600 transition-colors hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
            type="button"
          >
            今天
          </button>
        </div>

        {/* 日历主体 */}
        <div className="w-full max-w-5xl overflow-x-auto">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-400 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            </div>
          ) : (
            <div className="min-w-[640px]">
              {/* 星期表头 */}
              <div className="grid grid-cols-7 gap-1.5">
                {WEEK_DAYS.map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 日期网格 */}
              <div className="grid grid-cols-7 gap-1.5">
                {gridDays.map((date) => {
                  const key = dateKey(date)
                  const stats = dayStats.get(key)
                  const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
                  const isToday = isSameDay(date, today)
                  const isSelected = selectedDay && isSameDay(date, selectedDay.date)
                  const learnCount = stats ? stats.newWordsCount + stats.reviewCount : 0
                  const intensityClass = stats ? getIntensityClass(learnCount) : ''

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => stats && setSelectedDay(stats)}
                      className={`relative flex min-h-[80px] flex-col rounded-lg border p-2 text-left transition-all sm:min-h-[96px] ${
                        isToday
                          ? 'border-indigo-500 ring-1 ring-indigo-500'
                          : isSelected
                          ? 'border-indigo-400'
                          : 'border-gray-100 dark:border-gray-700'
                      } ${intensityClass} ${
                        isCurrentMonth ? '' : 'opacity-40'
                      } hover:shadow-md focus:outline-none`}
                    >
                      <span
                        className={`text-sm font-medium ${
                          isCurrentMonth ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {stats && (
                        <div className="mt-1 flex flex-col gap-0.5 text-[10px] leading-tight text-gray-600 dark:text-gray-200 sm:text-xs">
                          <span>学 {stats.newWordsCount}</span>
                          <span>复 {stats.reviewCount}</span>
                          {stats.wrongWordsCount > 0 && <span className="text-red-500 dark:text-red-400">错 {stats.wrongWordsCount}</span>}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 选中日期详情 */}
        {selectedDay && (
          <div className="mt-6 w-full max-w-5xl rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">
                {selectedDay.date.getFullYear()}年{selectedDay.date.getMonth() + 1}月{selectedDay.date.getDate()}日 详情
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                type="button"
              >
                关闭
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">新学单词</span>
                <span className="mt-1 text-2xl font-bold text-indigo-500 dark:text-indigo-400">{selectedDay.newWordsCount}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">复习章节</span>
                <span className="mt-1 text-2xl font-bold text-green-500 dark:text-green-400">{selectedDay.reviewCount}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">新增错词</span>
                <span className="mt-1 text-2xl font-bold text-red-500 dark:text-red-400">{selectedDay.wrongWordsCount}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">学习时长</span>
                <span className="mt-1 text-2xl font-bold text-gray-700 dark:text-gray-200">
                  {formatDuration(selectedDay.totalTime)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 当月汇总 */}
        <div className="mt-8 w-full max-w-5xl rounded-lg bg-white p-6 shadow-lg dark:bg-gray-700 dark:bg-opacity-50">
          <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
            {yearLabel}年{monthLabel}月 汇总
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-500 dark:text-gray-300">学习天数</span>
              <span className="mt-2 text-3xl font-bold text-indigo-500 dark:text-indigo-400">{monthSummary.learnDays}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-500 dark:text-gray-300">总学习单词</span>
              <span className="mt-2 text-3xl font-bold text-gray-700 dark:text-gray-200">{monthSummary.totalNew}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-500 dark:text-gray-300">总复习数</span>
              <span className="mt-2 text-3xl font-bold text-green-500 dark:text-green-400">{monthSummary.totalReview}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-500 dark:text-gray-300">总错词数</span>
              <span className="mt-2 text-3xl font-bold text-red-500 dark:text-red-400">{monthSummary.totalWrong}</span>
            </div>
          </div>
          {monthSummary.totalTime > 0 && (
            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              本月累计学习时长：{formatDuration(monthSummary.totalTime)}
            </p>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default Calendar
