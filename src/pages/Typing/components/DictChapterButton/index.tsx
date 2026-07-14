import Tooltip from '@/components/Tooltip'
import { currentChapterAtom, currentDictInfoAtom, isReviewModeAtom } from '@/store'
import range from '@/utils/range'
import { Listbox, Transition } from '@headlessui/react'
import { useAtom, useAtomValue } from 'jotai'
import { Fragment, useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import IconCheck from '~icons/tabler/check'
import { wordListFetcher } from '@/utils/wordListFetcher'
import useSWR from 'swr'
import type { Word } from '@/typings'
import { CHAPTER_LENGTH } from '@/constants'

export const DictChapterButton = () => {
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const chapterCount = currentDictInfo.chapterCount
  const isReviewMode = useAtomValue(isReviewModeAtom)
  
  // 获取词典数据以确定页码
  const { data: wordList } = useSWR<Word[]>(currentDictInfo.url, wordListFetcher)
  
  // 页码状态
  const [pageMap, setPageMap] = useState<Map<number, number>>(new Map()) // Map<页码, 章节>
  const [currentPage, setCurrentPage] = useState<number>(1)
  
  // 根据词典数据构建页码到章节的映射
  useEffect(() => {
    if (wordList && wordList.length > 0) {
      const newPageMap = new Map<number, number>()
      
      // 遍历所有单词，建立页码到章节的映射
      wordList.forEach((word, index) => {
        if (word.page !== undefined) {
          const chapterIndex = Math.floor(index / CHAPTER_LENGTH)
          if (!newPageMap.has(word.page)) {
            newPageMap.set(word.page, chapterIndex)
          }
        }
      })
      
      setPageMap(newPageMap)
      
      // 设置当前页码
      const currentWordIndex = currentChapter * CHAPTER_LENGTH
      if (currentWordIndex >= 0 && currentWordIndex < wordList.length && wordList[currentWordIndex].page !== undefined) {
        setCurrentPage(wordList[currentWordIndex].page!)
      }
    }
  }, [wordList, currentChapter, CHAPTER_LENGTH])
  
  // 处理页码变化
  const handlePageChange = (page: number) => {
    const chapter = pageMap.get(page)
    if (chapter !== undefined) {
      setCurrentChapter(chapter)
    }
  }
  
  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (event) => {
    if (event.key === ' ') {
      event.preventDefault()
    }
  }
  
  // 获取所有唯一页码
  const uniquePages = Array.from(pageMap.keys()).sort((a, b) => a - b)
  
  return (
    <>
      <Tooltip content="词典切换">
        <NavLink
          className="block rounded-lg px-3 py-1 text-lg transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white focus:outline-none dark:text-white dark:text-opacity-60 dark:hover:text-opacity-100"
          to="/gallery"
        >
          {currentDictInfo.name} {isReviewMode && '错题复习'}
        </NavLink>
      </Tooltip>
      {!isReviewMode && (
        <Tooltip content="页码切换">
          <Listbox value={currentPage} onChange={handlePageChange}>
            <Listbox.Button
              onKeyDown={handleKeyDown}
              className="rounded-lg px-3 py-1 text-lg transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white focus:outline-none dark:text-white dark:text-opacity-60 dark:hover:text-opacity-100"
            >
              第 {currentPage} 页
            </Listbox.Button>
            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
              <Listbox.Options className="listbox-options z-10 w-32">
                {uniquePages.map((page) => (
                  <Listbox.Option key={page} value={page}>
                    {({ selected }) => (
                      <div className="group flex cursor-pointer items-center justify-between">
                        {selected ? (
                          <span className="listbox-options-icon">
                            <IconCheck className="focus:outline-none" />
                          </span>
                        ) : null}
                        <span>第 {page} 页</span>
                      </div>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </Listbox>
        </Tooltip>
      )}
    </>
  )
}