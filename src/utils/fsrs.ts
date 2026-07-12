import { fsrs, createEmptyCard, Rating, type Card, type Grade, type RecordLogItem } from 'ts-fsrs'

// 创建 FSRS 实例，使用默认参数（目标保留率 0.9，最大间隔 36500 天）
const f = fsrs({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: false,
})

export { Rating, f as fsrsInstance }
export type { Card, Grade, RecordLogItem }

/**
 * 根据打字表现（错误次数、耗时）推断 FSRS 评分
 * @param wrongCount 输入错误次数
 * @param timing 输入时间差数组（毫秒）
 * @returns FSRS Grade (Again=1, Hard=2, Good=3, Easy=4)
 */
export function gradeFromTyping(wrongCount: number, timing: number[]): Grade {
  // 错误次数越多，评分越低
  if (wrongCount >= 3) return Rating.Again
  if (wrongCount === 2) return Rating.Hard
  if (wrongCount === 1) {
    // 错一次但整体较快 -> Hard, 较慢 -> Again
    const avg = timing.length > 0 ? timing.reduce((a, b) => a + b, 0) / timing.length : 0
    return avg > 800 ? Rating.Again : Rating.Hard
  }
  // wrongCount === 0
  const avg = timing.length > 0 ? timing.reduce((a, b) => a + b, 0) / timing.length : 0
  if (avg > 0 && avg < 250) return Rating.Easy
  return Rating.Good
}

/**
 * 创建空卡片
 */
export function createCard(): Card {
  return createEmptyCard(new Date())
}

/**
 * 对卡片进行评分，返回更新后的卡片和日志
 */
export function rateCard(card: Card, grade: Grade, now: Date = new Date()): RecordLogItem {
  return f.next(card, now, grade)
}

/**
 * 检查卡片是否到期（需要复习）
 */
export function isCardDue(card: Card, now: Date = new Date()): boolean {
  return new Date(card.due).getTime() <= now.getTime()
}

/**
 * 获取卡片的可检索性（记忆保留率）
 */
export function getRetrievability(card: Card, now: Date = new Date()): number {
  return f.get_retrievability(card, now, false)
}

/**
 * 格式化下次复习时间
 */
export function formatNextReview(card: Card, now: Date = new Date()): string {
  const due = new Date(card.due)
  const diffMs = due.getTime() - now.getTime()
  if (diffMs <= 0) return '现在'

  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffDay > 0) return `${diffDay} 天后`
  if (diffHour > 0) return `${diffHour} 小时后`
  if (diffMin > 0) return `${diffMin} 分钟后`
  return '即将'
}
