import { Button } from '@/components/ui/button'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { idDictionaryMap } from '@/resources/dictionary'
import { currentAccountIdAtom, currentChapterAtom, currentDictIdAtom, reviewModeInfoAtom } from '@/store'
import type { Word } from '@/typings'
import { db, getDueCards, getFsrsCardStats, type IFsrsCardRecord } from '@/utils/db'
import { ReviewRecord } from '@/utils/db/record'
import { formatNextReview, getRetrievability } from '@/utils/fsrs'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface FsrsStats {
  total: number
  dueCount: number
  dueCards: IFsrsCardRecord[]
  nextDueCard?: IFsrsCardRecord
}

/** 扩展的今日统计 */
interface TodayReviewStats {
  /** 今日已复习次数（chapterRecords 中 chapter=-1 且 timeStamp 在今天范围内） */
  todayReviewCount: number
  /** 所有过期卡片的平均记忆保留率（0~1），无卡片时为 0 */
  avgRetrievability: number
}

const Review = () => {
  const navigate = useNavigate()
  const accountId = useAtomValue(currentAccountIdAtom)
  const setReviewModeInfo = useSetAtom(reviewModeInfoAtom)
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)

  const [stats, setStats] = useState<FsrsStats | undefined>(undefined)
  const [todayStats, setTodayStats] = useState<TodayReviewStats>({ todayReviewCount: 0, avgRetrievability: 0 })
  const [isStarting, setIsStarting] = useState(false)

  const loadStats = useCallback(async () => {
    if (!accountId) {
      setStats(undefined)
      setTodayStats({ todayReviewCount: 0, avgRetrievability: 0 })
      return
    }
    const result = await getFsrsCardStats(accountId)
    setStats(result)

    // 查询今日已复习次数（chapter=-1 表示复习模式）
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const endOfToday = startOfToday + 86400000
    const todayReviewRecords = await db.chapterRecords
      .where('timeStamp')
      .between(startOfToday, endOfToday)
      .toArray()
    const todayReviewCount = todayReviewRecords.filter((r) => r.accountId === accountId && r.chapter === -1).length

    // 计算平均记忆保留率
    const allCards = await db.fsrsCards.where('accountId').equals(accountId).toArray()
    const nowDate = new Date()
    let totalR = 0
    let count = 0
    for (const record of allCards) {
      const r = getRetrievability(record.card, nowDate)
      if (r != null && !isNaN(r)) {
        totalR += r
        count++
      }
    }
    const avgRetrievability = count > 0 ? totalR / count : 0

    setTodayStats({ todayReviewCount, avgRetrievability })
  }, [accountId])

  useEffect(() => {
    loadStats()
    // 自动每 60 秒刷新到期卡片
    const intervalId = window.setInterval(loadStats, 60_000)
    return () => clearInterval(intervalId)
  }, [loadStats])

  const onBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  const startReview = async () => {
    if (!accountId) return
    setIsStarting(true)
    try {
      const dueCards = await getDueCards(accountId)
      if (dueCards.length === 0) {
        return
      }

      // 按词典分组，每个词典只拉取一次词表
      const cardsByDict = new Map<string, IFsrsCardRecord[]>()
      for (const card of dueCards) {
        const list = cardsByDict.get(card.dict) ?? []
        list.push(card)
        cardsByDict.set(card.dict, list)
      }

      // 拉取各词典词表并查找对应单词，保持到期顺序
      const wordsByCard = new Map<string, Word>()
      for (const [dictId, cards] of Array.from(cardsByDict.entries())) {
        const dict = idDictionaryMap[dictId]
        if (!dict) continue
        const wordList = await wordListFetcher(dict.url)
        const wordByName = new Map<string, Word>()
        for (const w of wordList) {
          wordByName.set(w.name, w)
        }
        for (const card of cards) {
          const w = wordByName.get(card.word)
          if (w) wordsByCard.set(`${dictId}::${card.word}`, w)
        }
      }

      const words: Word[] = dueCards.map((card) => wordsByCard.get(`${card.dict}::${card.word}`)).filter((w): w is Word => Boolean(w))

      if (words.length === 0) {
        return
      }

      // 以第一张到期卡片所在的词典作为本次复习词典
      const dictId = dueCards[0].dict
      setCurrentDictId(dictId)
      setCurrentChapter(-1)

      const record = new ReviewRecord(dictId, words, accountId)
      setReviewModeInfo({ isReviewMode: true, reviewRecord: record })
      navigate('/')
    } finally {
      setIsStarting(false)
    }
  }

  const isLoading = stats === undefined
  const dueCount = stats?.dueCount ?? 0
  const total = stats?.total ?? 0
  const nextDueCard = stats?.nextDueCard

  return (
    <Layout>
      <Header>
        <button
          className="rounded-lg bg-indigo-400 px-6 py-1 text-lg text-white focus:outline-none dark:text-opacity-80"
          onClick={onBack}
        >
          返回
        </button>
      </Header>
      <div className="container mx-auto flex w-full flex-1 flex-col items-center justify-center px-6 pb-10">
        <h1 className="mb-8 text-3xl font-bold text-indigo-500 dark:text-indigo-400">今日任务</h1>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-400 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          </div>
        ) : (
          <div className="w-full max-w-3xl overflow-hidden rounded-lg p-8 shadow-lg dark:bg-gray-700 dark:bg-opacity-50">
            {/* 2 行 x 3 列网格布局 */}
            <div className="grid grid-cols-3 gap-6">
              {/* 第一行 */}
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-500 dark:text-gray-300">待复习</span>
                <span className="mt-2 text-4xl font-bold text-indigo-500 dark:text-indigo-400">{dueCount}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-500 dark:text-gray-300">已学单词</span>
                <span className="mt-2 text-4xl font-bold text-gray-700 dark:text-gray-200">{total}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-500 dark:text-gray-300">下次最早复习</span>
                <span className="mt-2 text-lg font-medium text-gray-700 dark:text-gray-200">
                  {nextDueCard ? formatNextReview(nextDueCard.card) : '暂无'}
                </span>
              </div>
              {/* 第二行 */}
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-500 dark:text-gray-300">今日已复习</span>
                <span className="mt-2 text-4xl font-bold text-green-500 dark:text-green-400">{todayStats.todayReviewCount}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-500 dark:text-gray-300">记忆保留率</span>
                <span className="mt-2 text-4xl font-bold text-amber-500 dark:text-amber-400">
                  {Math.round(todayStats.avgRetrievability * 100)}%
                </span>
              </div>
              {/* 第二行第三列留空，保持网格对齐 */}
              <div />
            </div>

            {/* 今日学习建议 */}
            <div className="mt-6 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-900/30">
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {dueCount > 0
                  ? `建议先完成 ${dueCount} 个待复习单词，巩固记忆效果更佳`
                  : '今日复习已完成，可以学习新单词 🎉'}
              </p>
            </div>

            <div className="mt-6 flex justify-center">
              {dueCount > 0 ? (
                <Button size="lg" onClick={startReview} disabled={isStarting}>
                  {isStarting ? '加载中...' : '开始复习'}
                </Button>
              ) : (
                <p className="text-lg text-gray-500 dark:text-gray-300">暂无需要复习的单词，继续练习吧！</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Review
