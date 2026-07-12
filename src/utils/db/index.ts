import type { IChapterRecord, IReviewRecord, IRevisionDictRecord, IWordRecord, LetterMistakes } from './record'
import { ChapterRecord, ReviewRecord, WordRecord } from './record'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { TypingState } from '@/pages/Typing/store/type'
import { currentAccountIdAtom, currentChapterAtom, currentDictIdAtom, isReviewModeAtom } from '@/store'
import { createCard, gradeFromTyping, rateCard, type Card } from '@/utils/fsrs'
import type { Table } from 'dexie'
import Dexie from 'dexie'
import { useAtomValue } from 'jotai'
import { useCallback, useContext } from 'react'

// FSRS 卡片记录，用于间隔重复复习
export interface IFsrsCardRecord {
  id?: number
  accountId: string
  word: string
  dict: string
  // FSRS 卡片状态（序列化存储）
  card: Card
  // 最后一次评分
  lastRating?: number
  updatedAt: number
}

class RecordDB extends Dexie {
  wordRecords!: Table<IWordRecord, number>
  chapterRecords!: Table<IChapterRecord, number>
  reviewRecords!: Table<IReviewRecord, number>
  fsrsCards!: Table<IFsrsCardRecord, number>

  revisionDictRecords!: Table<IRevisionDictRecord, number>
  revisionWordRecords!: Table<IWordRecord, number>

  constructor() {
    super('RecordDB')
    this.version(1).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,errorCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    })
    this.version(2).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    })
    this.version(3).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
      reviewRecords: '++id,dict,createTime,isFinished',
    })
    // v4: 添加 accountId 索引用于多账户隔离，新增 fsrsCards 表用于 FSRS 间隔重复
    this.version(4)
      .stores({
        wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,accountId,[dict+chapter],[accountId+word]',
        chapterRecords: '++id,timeStamp,dict,chapter,time,accountId,[dict+chapter]',
        reviewRecords: '++id,dict,createTime,isFinished,accountId',
        fsrsCards: '++id,accountId,word,dict,[accountId+word],[accountId+dict],updatedAt',
      })
      .upgrade(async (tx) => {
        // 迁移：为已有记录补充默认 accountId
        await tx.table('wordRecords').toCollection().modify((rec: IWordRecord) => {
          if (!rec.accountId) rec.accountId = 'default'
        })
        await tx.table('chapterRecords').toCollection().modify((rec: IChapterRecord) => {
          if (!rec.accountId) rec.accountId = 'default'
        })
        await tx.table('reviewRecords').toCollection().modify((rec: IReviewRecord) => {
          if (!rec.accountId) rec.accountId = 'default'
        })
      })
  }
}

export const db = new RecordDB()

db.wordRecords.mapToClass(WordRecord)
db.chapterRecords.mapToClass(ChapterRecord)
db.reviewRecords.mapToClass(ReviewRecord)

export function useSaveChapterRecord() {
  const currentChapter = useAtomValue(currentChapterAtom)
  const isRevision = useAtomValue(isReviewModeAtom)
  const dictID = useAtomValue(currentDictIdAtom)
  const accountId = useAtomValue(currentAccountIdAtom)

  const saveChapterRecord = useCallback(
    (typingState: TypingState) => {
      const {
        chapterData: { correctCount, wrongCount, userInputLogs, wordCount, words, wordRecordIds },
        timerData: { time },
      } = typingState
      const correctWordIndexes = userInputLogs.filter((log) => log.correctCount > 0 && log.wrongCount === 0).map((log) => log.index)

      const chapterRecord = new ChapterRecord(
        dictID,
        isRevision ? -1 : currentChapter,
        time,
        correctCount,
        wrongCount,
        wordCount,
        correctWordIndexes,
        words.length,
        wordRecordIds ?? [],
        accountId,
      )
      db.chapterRecords.add(chapterRecord)
    },
    [currentChapter, dictID, isRevision, accountId],
  )

  return saveChapterRecord
}

export type WordKeyLogger = {
  letterTimeArray: number[]
  letterMistake: LetterMistakes
}

export function useSaveWordRecord() {
  const isRevision = useAtomValue(isReviewModeAtom)
  const currentChapter = useAtomValue(currentChapterAtom)
  const dictID = useAtomValue(currentDictIdAtom)
  const accountId = useAtomValue(currentAccountIdAtom)

  const { dispatch } = useContext(TypingContext) ?? {}

  const saveWordRecord = useCallback(
    async ({
      word,
      wrongCount,
      letterTimeArray,
      letterMistake,
    }: {
      word: string
      wrongCount: number
      letterTimeArray: number[]
      letterMistake: LetterMistakes
    }) => {
      const timing = []
      for (let i = 1; i < letterTimeArray.length; i++) {
        const diff = letterTimeArray[i] - letterTimeArray[i - 1]
        timing.push(diff)
      }

      const wordRecord = new WordRecord(word, dictID, isRevision ? -1 : currentChapter, timing, wrongCount, letterMistake, accountId)

      let dbID = -1
      try {
        dbID = await db.wordRecords.add(wordRecord)
      } catch (e) {
        console.error(e)
      }

      // 更新 FSRS 卡片
      try {
        await updateFsrsCard(accountId, word, dictID, wrongCount, timing)
      } catch (e) {
        console.error('Failed to update FSRS card:', e)
      }

      if (dispatch) {
        dbID > 0 && dispatch({ type: TypingStateActionType.ADD_WORD_RECORD_ID, payload: dbID })
        dispatch({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: false })
      }
    },
    [currentChapter, dictID, dispatch, isRevision, accountId],
  )

  return saveWordRecord
}

export function useDeleteWordRecord() {
  const accountId = useAtomValue(currentAccountIdAtom)
  const deleteWordRecord = useCallback(
    async (word: string, dict: string) => {
      try {
        const deletedCount = await db.wordRecords.where({ word, dict, accountId }).delete()
        return deletedCount
      } catch (error) {
        console.error(`删除单词记录时出错：`, error)
      }
    },
    [accountId],
  )

  return { deleteWordRecord }
}

// ===== FSRS 卡片管理 =====

async function updateFsrsCard(accountId: string, word: string, dict: string, wrongCount: number, timing: number[]) {
  const existing = await db.fsrsCards.where('[accountId+word]').equals([accountId, word]).first()

  const grade = gradeFromTyping(wrongCount, timing)
  const now = new Date()

  if (existing) {
    const { card: updatedCard } = rateCard(existing.card, grade, now)
    await db.fsrsCards.update(existing.id!, {
      card: updatedCard,
      lastRating: grade,
      updatedAt: now.getTime(),
    })
  } else {
    const newCard = createCard()
    const { card: updatedCard } = rateCard(newCard, grade, now)
    await db.fsrsCards.add({
      accountId,
      word,
      dict,
      card: updatedCard,
      lastRating: grade,
      updatedAt: now.getTime(),
    })
  }
}

// 查询到期需要复习的卡片
export async function getDueCards(accountId: string, limit: number = 50): Promise<IFsrsCardRecord[]> {
  const now = Date.now()
  const all = await db.fsrsCards.where('accountId').equals(accountId).toArray()
  return all
    .filter((record) => new Date(record.card.due).getTime() <= now)
    .sort((a, b) => new Date(a.card.due).getTime() - new Date(b.card.due).getTime())
    .slice(0, limit)
}

// 查询所有卡片统计
export async function getFsrsCardStats(accountId: string) {
  const all = await db.fsrsCards.where('accountId').equals(accountId).toArray()
  const now = Date.now()
  const due = all.filter((r) => new Date(r.card.due).getTime() <= now)
  // 找到最近的下次复习时间（非到期的卡片中最早到期的）
  const notDue = all.filter((r) => new Date(r.card.due).getTime() > now)
  const nextDue = notDue.length > 0 ? notDue.sort((a, b) => new Date(a.card.due).getTime() - new Date(b.card.due).getTime())[0] : undefined

  return {
    total: all.length,
    dueCount: due.length,
    dueCards: due,
    nextDueCard: nextDue,
  }
}
