import Tooltip from '@/components/Tooltip'
import { practiceModeAtom, type PracticeMode } from '@/store'
import { useAtom } from 'jotai'
import IconText from '~icons/tabler/abc'
import IconSentence from '~icons/tabler/message-2'

export default function PracticeModeSwitcher() {
  const [mode, setMode] = useAtom(practiceModeAtom)

  const toggle = () => {
    const next: PracticeMode = mode === 'word' ? 'sentence' : 'word'
    setMode(next)
  }

  return (
    <Tooltip className="h-7 w-7" content={mode === 'word' ? '当前：单词模式（点击切换到句子模式）' : '当前：句子模式（点击切换到单词模式）'}>
      <button
        className={`p-[2px] text-lg focus:outline-none ${mode === 'sentence' ? 'text-indigo-500' : 'text-gray-500'}`}
        type="button"
        onClick={(e) => {
          toggle()
          e.currentTarget.blur()
        }}
        aria-label="切换练习模式"
      >
        {mode === 'word' ? <IconText /> : <IconSentence />}
      </button>
    </Tooltip>
  )
}
