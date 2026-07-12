import { fontSizeConfigAtom, isTextSelectableAtom } from '@/store'
import type { Word } from '@/typings'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'

interface SentenceContextProps {
  word: Word
  /** 是否已答对（用于在句子中揭示目标词） */
  revealed?: boolean
}

/**
 * 句子模式上下文组件：将例句中的目标单词挖空显示，帮助用户在上下文中默写。
 * 仅当 trans[0] 包含目标单词时才渲染（否则视为普通词典，不显示）。
 */
export default function SentenceContext({ word, revealed = false }: SentenceContextProps) {
  const fontSizeConfig = useAtomValue(fontSizeConfigAtom)
  const isTextSelectable = useAtomValue(isTextSelectableAtom)

  const { before, blank, after, hasSentence } = useMemo(() => {
    const sentence = word.trans?.[0] ?? ''
    const target = word.name ?? ''
    if (!sentence || !target) {
      return { before: '', blank: '', after: '', hasSentence: false }
    }
    // 大小写不敏感查找目标词在例句中的位置
    const idx = sentence.toLowerCase().indexOf(target.toLowerCase())
    if (idx === -1) {
      return { before: '', blank: '', after: '', hasSentence: false }
    }
    return {
      before: sentence.slice(0, idx),
      blank: sentence.slice(idx, idx + target.length),
      after: sentence.slice(idx + target.length),
      hasSentence: true,
    }
  }, [word.name, word.trans])

  if (!hasSentence) return null

  // 挖空显示：用与单词等长的下划线占位；答对后揭示
  const blankPlaceholder = '_'.repeat(Math.max(blank.length, 3))

  return (
    <div className={`flex w-full max-w-3xl items-center justify-center px-4 pb-2 pt-1 ${isTextSelectable ? 'select-text' : ''}`}>
      <p
        className="text-center font-sans text-gray-600 dark:text-gray-300"
        style={{ fontSize: (fontSizeConfig.translateFont - 2).toString() + 'px' }}
      >
        <span>{before}</span>
        <span className={`mx-1 inline-block border-b-2 font-mono ${revealed ? 'text-indigo-500 dark:text-indigo-400' : 'text-transparent'}`}>
          {revealed ? blank : blankPlaceholder}
        </span>
        <span>{after}</span>
      </p>
    </div>
  )
}
