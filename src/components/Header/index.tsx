import AccountSwitcher from '@/components/AccountSwitcher'
import logo from '@/assets/logo.svg'
import type { PropsWithChildren } from 'react'
import type React from 'react'
import { NavLink } from 'react-router-dom'
import IconCalendar from '~icons/tabler/calendar'

const Header: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <header className="container z-20 mx-auto w-full px-10 py-6">
      <div className="flex w-full flex-col items-center justify-between space-y-3 lg:flex-row lg:space-y-0">
        <NavLink
          className="flex items-center text-2xl font-bold text-indigo-500 no-underline hover:no-underline lg:text-4xl"
          to="/"
        >
          <img src={logo} className="mr-3 h-16 w-16" alt="KUKU单词 Logo" />
          <h1>KUKU单词</h1>
        </NavLink>
        <nav className="my-card on element flex w-auto content-center items-center justify-end space-x-3 rounded-xl bg-white p-4 transition-colors duration-300 dark:bg-gray-800">
          <AccountSwitcher />
          <NavLink
            to="/calendar"
            aria-label="学习日历"
            className={({ isActive }) =>
              `flex items-center gap-1 rounded-lg px-2 py-1 text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-100 text-indigo-600 dark:bg-gray-700 dark:text-indigo-400'
                  : 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-gray-700'
              }`
            }
          >
            <IconCalendar className="h-5 w-5" />
            <span className="hidden sm:inline">日历</span>
          </NavLink>
          {children}
        </nav>
      </div>
    </header>
  )
}

export default Header
