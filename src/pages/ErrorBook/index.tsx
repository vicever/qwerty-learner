import DropdownExport from './DropdownExport'
import ErrorRow from './ErrorRow'
import type { ISortType } from './HeadWrongNumber'
import HeadWrongNumber from './HeadWrongNumber'
import Pagination, { ITEM_PER_PAGE } from './Pagination'
import RowDetail from './RowDetail'
import { currentRowDetailAtom } from './store'
import type { groupedWordRecords } from './type'
import { idDictionaryMap } from '@/resources/dictionary'
import { currentAccountIdAtom, currentChapterAtom, currentDictIdAtom, reviewModeInfoAtom } from '@/store'
import type { Word } from '@/typings'
import { db, useDeleteWordRecord } from '@/utils/db'
import { ReviewRecord, type WordRecord } from '@/utils/db/record'
import { wordListFetcher } from '@/utils/wordListFetcher'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IconX from '~icons/tabler/x'

// 生成错词的唯一 key，用于批量选中状态管理
function getRecordKey(record: groupedWordRecords): string {
  return `${record.dict}::${record.word}`
}

export function ErrorBook() {
  const [groupedRecords, setGroupedRecords] = useState<groupedWordRecords[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = useMemo(() => Math.ceil(groupedRecords.length / ITEM_PER_PAGE), [groupedRecords.length])
  const [sortType, setSortType] = useState<ISortType>('asc')
  const navigate = useNavigate()
  const accountId = useAtomValue(currentAccountIdAtom)
  const currentRowDetail = useAtomValue(currentRowDetailAtom)
  const { deleteWordRecord } = useDeleteWordRecord()
  const [reload, setReload] = useState(false)
  // 批量选中的错词 key 集合，格式 `${dict}::${word}`
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set())
  const setReviewModeInfo = useSetAtom(reviewModeInfoAtom)
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)

  const onBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  const setPage = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return
      setCurrentPage(page)
    },
    [totalPages],
  )

  const setSort = useCallback(
    (sortType: ISortType) => {
      setSortType(sortType)
      setPage(1)
    },
    [setPage],
  )

  const sortedRecords = useMemo(() => {
    if (sortType === 'none') return groupedRecords
    return [...groupedRecords].sort((a, b) => {
      if (sortType === 'asc') {
        return a.wrongCount - b.wrongCount
      } else {
        return b.wrongCount - a.wrongCount
      }
    })
  }, [groupedRecords, sortType])

  const renderRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEM_PER_PAGE
    const end = start + ITEM_PER_PAGE
    return sortedRecords.slice(start, end)
  }, [currentPage, sortedRecords])

  useEffect(() => {
    db.wordRecords
      .where('wrongCount')
      .above(0)
      .toArray()
      .then((records) => records.filter((r) => r.accountId === accountId))
      .then((records) => {
        const groups: groupedWordRecords[] = []

        records.forEach((record) => {
          let group = groups.find((g) => g.word === record.word && g.dict === record.dict)
          if (!group) {
            group = { word: record.word, dict: record.dict, records: [], wrongCount: 0, lastWrongTime: 0 }
            groups.push(group)
          }
          group.records.push(record as WordRecord)
        })

        groups.forEach((group) => {
          group.wrongCount = group.records.reduce((acc, cur) => {
            acc += cur.wrongCount
            return acc
          }, 0)
          // 计算最近错误时间：取 records 中最新的 timeStamp
          group.lastWrongTime = Math.max(...group.records.map((r) => r.timeStamp))
        })

        setGroupedRecords(groups)
      })
  }, [reload, accountId])

  const handleDelete = async (word: string, dict: string) => {
    await deleteWordRecord(word, dict)
    setReload((prev) => !prev)
  }

  // 切换单个错词的选中状态
  const onToggleSelect = useCallback((record: groupedWordRecords) => {
    const key = getRecordKey(record)
    setSelectedWords((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // 当前页的全选/取消全选
  const onSelectAllPage = useCallback(() => {
    setSelectedWords((prev) => {
      const next = new Set(prev)
      const pageKeys = renderRecords.map(getRecordKey)
      const allSelected = pageKeys.length > 0 && pageKeys.every((k) => next.has(k))
      if (allSelected) {
        pageKeys.forEach((k) => next.delete(k))
      } else {
        pageKeys.forEach((k) => next.add(k))
      }
      return next
    })
  }, [renderRecords])

  // 当前页的选中状态：全选 / 部分选中
  const pageKeys = useMemo(() => renderRecords.map(getRecordKey), [renderRecords])
  const isAllPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selectedWords.has(k))
  const isSomePageSelected = pageKeys.some((k) => selectedWords.has(k))

  // 全选 checkbox 的 indeterminate 状态需要通过 ref 设置
  const selectAllRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (el) {
        el.indeterminate = isSomePageSelected && !isAllPageSelected
      }
    },
    [isSomePageSelected, isAllPageSelected],
  )

  // 批量练习：收集所有选中错词，按词典分组拉取词表后进入复习模式
  const handleBatchPractice = useCallback(async () => {
    if (selectedWords.size === 0) return
    // 按排序后的顺序收集选中的错词记录
    const selectedRecords = sortedRecords.filter((r) => selectedWords.has(getRecordKey(r)))
    if (selectedRecords.length === 0) return

    // 错词可能来自不同词典，按词典分组收集单词名
    const dictToWords = new Map<string, string[]>()
    selectedRecords.forEach((r) => {
      const arr = dictToWords.get(r.dict) ?? []
      arr.push(r.word)
      dictToWords.set(r.dict, arr)
    })

    // ReviewRecord 只能绑定一个词典，采用第一个出现的词典作为主词典
    const firstDict = selectedRecords[0].dict

    try {
      // 并发拉取所有涉及的词典词表
      const dictWordListEntries = await Promise.all(
        Array.from(dictToWords.keys()).map(async (dict) => {
          const dictInfo = idDictionaryMap[dict]
          const wordList = dictInfo ? await wordListFetcher(dictInfo.url) : []
          return [dict, wordList] as const
        }),
      )
      const dictWordListMap = new Map(dictWordListEntries)

      // 按选中顺序查找对应的 Word 对象
      const allWords: Word[] = []
      selectedRecords.forEach((r) => {
        const wordList = dictWordListMap.get(r.dict) ?? []
        const w = wordList.find((item) => item.name === r.word)
        if (w) allWords.push(w)
      })
      if (allWords.length === 0) return

      // 创建复习记录并进入复习模式
      const reviewRecord = new ReviewRecord(firstDict, allWords, accountId)
      setReviewModeInfo({ isReviewMode: true, reviewRecord })
      setCurrentDictId(firstDict)
      setCurrentChapter(-1)
      navigate('/')
    } catch (e) {
      console.error('[批量练习] 出错:', e)
    }
  }, [selectedWords, sortedRecords, accountId, setReviewModeInfo, setCurrentDictId, setCurrentChapter, navigate])

  return (
    <>
      <div className={`relative flex h-screen w-full flex-col items-center pb-4 ease-in ${currentRowDetail && 'blur-sm'}`}>
        <div className="mr-8 mt-4 flex w-auto items-center justify-center self-end">
          <h1 className="font-lighter mr-4 w-auto self-end text-gray-500 opacity-70">Tip: 点击错误单词查看详细信息 </h1>
          {selectedWords.size > 0 && (
            <button
              className="mr-4 rounded bg-indigo-500 px-4 py-1.5 text-sm text-white shadow-md hover:bg-indigo-600 active:bg-indigo-700"
              onClick={handleBatchPractice}
            >
              批量练习 ({selectedWords.size})
            </button>
          )}
          <IconX className="h-7 w-7 cursor-pointer text-gray-400" onClick={onBack} />
        </div>

        <div className="flex w-full flex-1 select-text items-start justify-center overflow-hidden">
          <div className="flex h-full w-5/6 flex-col pt-10">
            <div className="flex w-full justify-between rounded-lg bg-white px-6 py-5 text-lg text-black shadow-lg dark:bg-gray-800 dark:text-white">
              <span className="flex basis-1/12 justify-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer"
                  checked={isAllPageSelected}
                  ref={selectAllRef}
                  onChange={onSelectAllPage}
                />
              </span>
              <span className="basis-2/12">单词</span>
              <span className="basis-4/12">释义</span>
              <HeadWrongNumber className="basis-1/12" sortType={sortType} setSortType={setSort} />
              <span className="basis-2/12">最近错误</span>
              <span className="basis-1/12">词典</span>
              <span className="basis-1/12">操作</span>
              <DropdownExport renderRecords={sortedRecords} />
            </div>
            <ScrollArea.Root className="flex-1 overflow-y-auto pt-5">
              <ScrollArea.Viewport className="h-full  ">
                <div className="flex flex-col gap-3">
                  {renderRecords.map((record) => (
                    <ErrorRow
                      key={`${record.dict}-${record.word}`}
                      record={record}
                      onDelete={() => handleDelete(record.word, record.dict)}
                      isSelected={selectedWords.has(getRecordKey(record))}
                      onToggleSelect={() => onToggleSelect(record)}
                    />
                  ))}
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent" orientation="vertical"></ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </div>
        </div>
        <Pagination className="pt-3" page={currentPage} setPage={setPage} totalPages={totalPages} />
      </div>
      {currentRowDetail && <RowDetail currentRowDetail={currentRowDetail} allRecords={sortedRecords} />}
    </>
  )
}
