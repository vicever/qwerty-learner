import type React from 'react'

const Footer: React.FC = () => {
  return (
    <footer className="mb-1 mt-4 flex w-full items-center justify-center gap-2.5 text-sm ease-in">
      <span className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        @ KUKU单词 zhanggs.com
      </span>
      <span className="select-none rounded bg-slate-200 px-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        Build <span className="select-all">{LATEST_COMMIT_HASH}</span>
      </span>
    </footer>
  )
}

export default Footer
