import { db } from '.'
import { ReviewRecord } from './record'
import type { TErrorWordData } from '@/pages/Gallery-N/hooks/useErrorWords'
import type { Word } from '@/typings'
import { useEffect, useState } from 'react'

export function useGetLatestReviewRecord(dictID: string, accountId?: string) {
  const [wordReviewRecord, setWordReviewRecord] = useState<ReviewRecord | undefined>(undefined)
  useEffect(() => {
    const fetchWordReviewRecords = async () => {
      const record = await getReviewRecords(dictID, accountId)
      setWordReviewRecord(record)
    }
    if (dictID) {
      fetchWordReviewRecords()
    }
  }, [dictID, accountId])
  return wordReviewRecord
}

async function getReviewRecords(dictID: string, accountId?: string): Promise<ReviewRecord | undefined> {
  let collection = db.reviewRecords.where('dict').equals(dictID)
  if (accountId) {
    const all = await collection.toArray()
    const records = all.filter((r) => r.accountId === accountId)
    const latestRecord = records.sort((a, b) => a.createTime - b.createTime).pop()
    return latestRecord && (latestRecord.isFinished ? undefined : latestRecord)
  }
  const records = await collection.toArray()
  const latestRecord = records.sort((a, b) => a.createTime - b.createTime).pop()
  return latestRecord && (latestRecord.isFinished ? undefined : latestRecord)
}

type TRankedErrorWordData = TErrorWordData & {
  errorCountScore: number
  latestErrorTimeScore: number
}

export async function generateNewWordReviewRecord(dictID: string, errorData: TErrorWordData[], accountId?: string) {
  const errorCountRankings = [...errorData].sort((a, b) => a.errorCount - b.errorCount)
  const latestErrorTimeRankings = [...errorData].sort((a, b) => a.latestErrorTime - b.latestErrorTime)

  const errorDataWithRank: TRankedErrorWordData[] = errorData.map((item) => ({
    ...item,
    errorCountScore: errorCountRankings.indexOf(item) + 1,
    latestErrorTimeScore: latestErrorTimeRankings.indexOf(item) + 1,
  }))

  const errorCountWeight = 0.6
  const latestErrorTimeWeight = 0.4

  const sortedWords: Word[] = errorDataWithRank
    .sort((a, b) => {
      const scoreA = a.errorCountScore * errorCountWeight + a.latestErrorTimeScore * latestErrorTimeWeight
      const scoreB = b.errorCountScore * errorCountWeight + b.latestErrorTimeScore * latestErrorTimeWeight
      return scoreA - scoreB
    })
    .map((item) => item.originData)

  const record = new ReviewRecord(dictID, sortedWords, accountId)

  await db.reviewRecords.put(record)
  return record
}

export async function putWordReviewRecord(record: ReviewRecord) {
  db.reviewRecords.put(record)
}
