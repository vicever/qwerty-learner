import Loading from './components/Loading'
import './index.css'
import { ErrorBook } from './pages/ErrorBook'
import { FriendLinks } from './pages/FriendLinks'
import MobilePage from './pages/Mobile'
import TypingPage from './pages/Typing'
import { initAccount, isOpenDarkModeAtom } from '@/store'
import { autoBackupOnVersionUpgrade, checkDataIntegrity, fixDataIntegrity } from '@/utils/db/backup'
import { Analytics } from '@vercel/analytics/react'
import 'animate.css'
import { useAtomValue } from 'jotai'
import mixpanel from 'mixpanel-browser'
import process from 'process'
import React, { Suspense, lazy, useEffect, useState } from 'react'
import 'react-app-polyfill/stable'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const AnalysisPage = lazy(() => import('./pages/Analysis'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const DataManagerPage = lazy(() => import('./pages/DataManager'))
const GalleryPage = lazy(() => import('./pages/Gallery-N'))
const ReviewPage = lazy(() => import('./pages/Review'))

if (process.env.NODE_ENV === 'production') {
  // for prod
  mixpanel.init('bdc492847e9340eeebd53cc35f321691')
} else {
  // for dev
  mixpanel.init('5474177127e4767124c123b2d7846e2a', { debug: true })
}

function Root() {
  const darkMode = useAtomValue(isOpenDarkModeAtom)
  useEffect(() => {
    darkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark')
  }, [darkMode])

  useEffect(() => {
    initAccount()
    autoBackupOnVersionUpgrade()
    checkDataIntegrity().then((result) => {
      if (!result.valid) {
        console.warn('数据完整性检查失败:', result.issues)
        fixDataIntegrity().then((fixResult) => {
          if (fixResult.success) {
            console.log('数据修复成功:', fixResult.message)
          } else {
            console.error('数据修复失败:', fixResult.message)
          }
        })
      }
    })
  }, [])

  const [isMobile, setIsMobile] = useState(() => {
    const width = window.innerWidth
    const isIpad = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    return !isIpad && width <= 600
  })

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      const isIpad = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
      const isMobile = !isIpad && width <= 600
      if (!isMobile) {
        window.location.href = '/'
      }
      setIsMobile(isMobile)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <React.StrictMode>
      <BrowserRouter basename={REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''}>
        <Suspense fallback={<Loading />}>
          <Routes>
            {isMobile ? (
              <Route path="/*" element={<Navigate to="/mobile" />} />
            ) : (
              <>
                <Route index element={<TypingPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/data-manager" element={<DataManagerPage />} />
                <Route path="/error-book" element={<ErrorBook />} />
                <Route path="/friend-links" element={<FriendLinks />} />
                <Route path="/*" element={<Navigate to="/" />} />
              </>
            )}
            <Route path="/mobile" element={<MobilePage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Analytics />
    </React.StrictMode>
  )
}

const container = document.getElementById('root')

container && createRoot(container).render(<Root />)
