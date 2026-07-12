import { currentAccountIdAtom } from '@/store'
import { db } from '@/utils/db'
import { useAtomValue } from 'jotai'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'

export function useChapterNumber() {
  const accountId = useAtomValue(currentAccountIdAtom)
  const [chapterNumber, setChapterNumber] = useState<number>(0)

  useEffect(() => {
    const fetchChapterNumber = async () => {
      const number = await db.chapterRecords.filter((r) => r.accountId === accountId).count()
      setChapterNumber(number)
    }

    fetchChapterNumber()
  }, [accountId])

  return chapterNumber
}

export function useDayFromFirstWordRecord() {
  const accountId = useAtomValue(currentAccountIdAtom)
  const [dayFromFirstWordRecord, setDayFromFirstWordRecord] = useState<number>(0)

  useEffect(() => {
    const fetchDayFromFirstWordRecord = async () => {
      const firstWordRecord = await db.wordRecords.orderBy('timeStamp').filter((r) => r.accountId === accountId).first()
      const firstWordRecordTimeStamp = firstWordRecord?.timeStamp || 0
      const now = dayjs()
      const timestamp = dayjs.unix(firstWordRecordTimeStamp)
      const daysPassed = now.diff(timestamp, 'day')
      setDayFromFirstWordRecord(daysPassed)
    }

    fetchDayFromFirstWordRecord()
  }, [accountId])

  return dayFromFirstWordRecord
}

export function useWordNumber() {
  const accountId = useAtomValue(currentAccountIdAtom)
  const [wordNumber, setWordNumber] = useState<number>(0)

  useEffect(() => {
    const fetchWordNumber = async () => {
      const number = await db.wordRecords.filter((r) => r.accountId === accountId).count()
      setWordNumber(number)
    }

    fetchWordNumber()
  }, [accountId])

  return wordNumber
}

export function useSumWrongCount() {
  const accountId = useAtomValue(currentAccountIdAtom)
  const [sumWrongCount, setSumWrongCount] = useState<number>(0)

  useEffect(() => {
    const fetchSumWrongCount = async () => {
      let totalWrongCount = 0

      await db.chapterRecords.filter((r) => r.accountId === accountId).each((record) => {
        totalWrongCount += record.wrongCount || 0
      })
      setSumWrongCount(totalWrongCount)
    }

    fetchSumWrongCount()
  }, [accountId])

  return sumWrongCount
}
