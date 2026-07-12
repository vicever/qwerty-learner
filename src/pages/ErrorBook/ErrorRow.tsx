import { LoadingWordUI } from './LoadingWordUI'
import useGetWord from './hooks/useGetWord'
import { currentRowDetailAtom } from './store'
import type { groupedWordRecords } from './type'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { idDictionaryMap } from '@/resources/dictionary'
import { currentAccountIdAtom, currentChapterAtom, currentDictIdAtom, reviewModeInfoAtom } from '@/store'
import { recordErrorBookAction } from '@/utils'
import { ReviewRecord } from '@/utils/db/record'
import { useAtomValue, useSetAtom } from 'jotai'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DeleteIcon from '~icons/weui/delete-filled'

type IErrorRowProps = {
  record: groupedWordRecords
  onDelete: () => void
  // 是否被选中（用于批量练习）
  isSelected: boolean
  // 切换选中状态
  onToggleSelect: () => void
}

// 将 UTC 时间戳格式化为日期字符串
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const ErrorRow: FC<IErrorRowProps> = ({ record, onDelete, isSelected, onToggleSelect }) => {
  const setCurrentRowDetail = useSetAtom(currentRowDetailAtom)
  const setReviewModeInfo = useSetAtom(reviewModeInfoAtom)
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)
  const navigate = useNavigate()
  const accountId = useAtomValue(currentAccountIdAtom)
  const dictInfo = idDictionaryMap[record.dict]
  const { word, isLoading, hasError } = useGetWord(record.word, dictInfo)

  // 格式化最近错误时间
  const lastWrongTimeStr = useMemo(() => formatTimestamp(record.lastWrongTime), [record.lastWrongTime])

  const onClick = useCallback(() => {
    setCurrentRowDetail(record)
    recordErrorBookAction('detail')
  }, [record, setCurrentRowDetail])

  // 点击"练习"按钮，进入复习模式默写该错词
  const onPractice = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!word) return
      // 创建复习记录，使用该单词所在的词典
      const reviewRecord = new ReviewRecord(record.dict, [word], accountId)
      setReviewModeInfo({ isReviewMode: true, reviewRecord })
      setCurrentDictId(record.dict)
      setCurrentChapter(-1)
      navigate('/')
    },
    [word, record.dict, accountId, setReviewModeInfo, setCurrentDictId, setCurrentChapter, navigate],
  )

  return (
    <li
      className="opacity-85 flex w-full cursor-pointer items-center justify-between rounded-lg bg-white px-6 py-3 text-black shadow-md dark:bg-gray-800 dark:text-white"
      onClick={onClick}
    >
      <span
        className="flex basis-1/12 justify-center"
        onClick={(e) => {
          // 阻止冒泡，避免触发行点击事件
          e.stopPropagation()
          onToggleSelect()
        }}
      >
        <input type="checkbox" className="h-4 w-4 cursor-pointer" checked={isSelected} readOnly />
      </span>
      <span className="basis-2/12 break-normal">{record.word}</span>
      <span className="basis-4/12 break-normal">
        {word ? word.trans.join('；') : <LoadingWordUI isLoading={isLoading} hasError={hasError} />}
      </span>
      <span className="basis-1/12 break-normal pl-8">{record.wrongCount}</span>
      <span className="basis-2/12 break-normal text-xs text-gray-400">{lastWrongTimeStr}</span>
      <span className="basis-1/12 break-normal">{dictInfo?.name}</span>
      <span
        className="basis-1/12 break-normal"
        onClick={(e) => {
          e.stopPropagation()
          onPractice(e)
        }}
      >
        <button className="rounded bg-indigo-500 px-2 py-0.5 text-xs text-white hover:bg-indigo-600 active:bg-indigo-700">
          练习
        </button>
      </span>
      <span
        className="basis-1/12 break-normal"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DeleteIcon />
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete Records</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>
    </li>
  )
}

export default ErrorRow
