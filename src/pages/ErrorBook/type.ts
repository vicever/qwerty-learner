import type { WordRecord } from '@/utils/db/record'

export type groupedWordRecords = {
  word: string
  dict: string
  records: WordRecord[]
  wrongCount: number
  // 最近错误时间（UTC时间戳）
  lastWrongTime: number
}
