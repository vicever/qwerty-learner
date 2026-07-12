import { currentAccountIdAtom } from '@/store'
import { db } from '@/utils/db'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'

export function useRevisionWordCount(dictID: string) {
  const accountId = useAtomValue(currentAccountIdAtom)
  const [wordCount, setWordCount] = useState<number>(0)

  useEffect(() => {
    const fetchWordCount = async () => {
      const count = await getRevisionWordCount(dictID, accountId)
      setWordCount(count)
    }

    if (dictID) {
      fetchWordCount()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictID, accountId])

  return wordCount
}

async function getRevisionWordCount(dict: string, accountId: string): Promise<number> {
  const wordCount = await db.wordRecords
    .where('dict')
    .equals(dict)
    .and((wordRecord) => wordRecord.wrongCount > 0 && wordRecord.accountId === accountId)
    .toArray()
    .then((wordRecords) => {
      const res = new Map()
      const reducedRecords = wordRecords.filter((item) => !res.has(item['word'] + item['dict']) && res.set(item['word'] + item['dict'], 1))
      return reducedRecords.length
    })
  return wordCount
}
