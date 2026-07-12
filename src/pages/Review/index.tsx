import { Button } from '@/components/ui/button'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { idDictionaryMap } from '@/resources/dictionary'
import { currentAccountIdAtom, currentChapterAtom, currentDictIdAtom, reviewModeInfoAtom } from '@/store'
import type { Word } from '@/typings'
import { db, getDueCards, getFsrsCardStats, type IFsrsCardRecord } from '@/utils/db'
import { ReviewRecord } from '@/utils/db/record'
import { formatNextReview } from '@/utils/fsrs'
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

const Review = () => {
  const navigate = useNavigate()
  const accountId = useAtomValue(currentAccountIdAtom)
  const setReviewModeInfo = useSetAtom(reviewModeInfoAtom)
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)

  const [stats, setStats] = useState<FsrsStats | undefined>(undefined)
  const [isStarting, setIsStarting] = useState(false)

  const loadStats = useCallback(async () => {
    if (!accountId) {
      setStats(undefined)
      return
    }
    const result = await getFsrsCardStats(accountId)
    setStats(result)
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
        <h1 className="mb-8 text-3xl font-bold text-indigo-500 dark:text-indigo-400">复习队列</h1>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-400 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          </div>
        ) : (
          <div className="w-full max-w-3xl overflow-hidden rounded-lg p-8 shadow-lg dark:bg-gray-700 dark:bg-opacity-50">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-500 dark:text-gray-300">待复习</span>
                <span className="mt-2 text-5xl font-bold text-indigo-500 dark:text-indigo-400">{dueCount}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-500 dark:text-gray-300">下次复习</span>
                <span className="mt-2 text-lg font-medium text-gray-700 dark:text-gray-200">
                  {nextDueCard ? formatNextReview(nextDueCard.card) : '暂无'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-500 dark:text-gray-300">已学单词</span>
                <span className="mt-2 text-5xl font-bold text-gray-700 dark:text-gray-200">{total}</span>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
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
