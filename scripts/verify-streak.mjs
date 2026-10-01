import assert from 'node:assert/strict'
import { getWateringStreakSummary, updateWateringGoal, calculateAchievements } from '../src/services/gardenRules.js'
import { DEFAULT_GOALS } from '../src/constants/garden.js'
import { shiftDateISO } from '../src/utils/date.js'

const TODAY = '2026-10-01'
const watering = (dates, plantId = 'p1') =>
  dates.map((date, i) => ({ id: `c${i}`, type: '浇水', date, plantId }))
const isoOffset = (days, base = TODAY) => shiftDateISO(base, days)
const range = (start, end) => {
  const out = []
  for (let d = start; d <= end; d += 1) out.push(isoOffset(d))
  return out
}

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`✓ ${name}`)
}

// 1. 无任何记录：明确起点，不是 0 天无故归零
check('empty: 无记录时 state=empty 且不达标', () => {
  const s = getWateringStreakSummary([], TODAY)
  assert.equal(s.state, 'empty')
  assert.equal(s.streak, 0)
  const goals = updateWateringGoal(DEFAULT_GOALS, [])
  assert.equal(goals[0].completed, false)
  assert.equal(goals[0].progressDays, 0)
  assert.match(goals[0].streakHint, /还没有浇水记录/)
})

// 2. 只有今天
check('today: 今天浇水 streak=1 state=today', () => {
  const s = getWateringStreakSummary(watering([TODAY]), TODAY)
  assert.equal(s.state, 'today')
  assert.equal(s.streak, 1)
  assert.equal(s.startDate, TODAY)
})

// 3. 核心诉求：昨天浇了、今天没浇 → 保留进度 pending，不清零
check('pending: 昨天有记录今天无记录，保留 1 天，不清零', () => {
  const s = getWateringStreakSummary(watering([isoOffset(-1)]), TODAY)
  assert.equal(s.state, 'pending')
  assert.equal(s.streak, 1)
  assert.equal(s.startDate, isoOffset(-1))
  assert.equal(s.endDate, isoOffset(-1))
  const goals = updateWateringGoal(DEFAULT_GOALS, watering([isoOffset(-1)]))
  assert.equal(goals[0].completed, false)
  assert.equal(goals[0].progressDays, 1)
  assert.match(goals[0].streakHint, /今天补记/)
})

// 4. 时区 bug 回归：东八区下回退日期不能跳过昨天
check('timezone: 昨天+今天应计为 2 天（旧 UTC 逻辑只给 1）', () => {
  const s = getWateringStreakSummary(watering([isoOffset(-1), TODAY]), TODAY)
  assert.equal(s.streak, 2)
  assert.equal(s.startDate, isoOffset(-1))
})

// 5. 长连续 + pending：昨天满 5 天，今天没浇，进度保留 5
check('pending: 连续 5 天至昨天，今天未浇保留 5 天', () => {
  const dates = range(-5, -1)
  const s = getWateringStreakSummary(watering(dates), TODAY)
  assert.equal(s.state, 'pending')
  assert.equal(s.streak, 5)
  assert.equal(s.startDate, isoOffset(-5))
})

// 6. 30 天边界：截至昨天满 30，今天未浇 → 展示 30/30 但不达标、不发徽章
check('boundary: 截至昨天 30 天，pending 不达标不发徽章', () => {
  const dates = range(-30, -1) // 截至昨天 30 天
  const s = getWateringStreakSummary(watering(dates), TODAY)
  assert.equal(s.state, 'pending')
  assert.equal(s.streak, 30)
  const goals = updateWateringGoal(DEFAULT_GOALS, watering(dates))
  assert.equal(goals[0].progressDays, 30)
  assert.equal(goals[0].completed, false)
  const ach = calculateAchievements([], watering(dates), [], [], goals)
  assert.ok(!ach.earned.some((a) => a.id === 'thirty-day-goal'), 'pending 30 天不应点亮徽章')
  assert.match(goals[0].streakHint, /点亮/)
})

// 7. 30 天边界：含今天满 30 → 达标并发徽章
check('boundary: 含今天满 30 天达标并点亮徽章', () => {
  const dates = range(-29, 0) // 含今天满 30 天
  const goals = updateWateringGoal(DEFAULT_GOALS, watering(dates))
  assert.equal(goals[0].completed, true)
  assert.equal(goals[0].progressDays, 30)
  const ach = calculateAchievements([], watering(dates), [], [], goals)
  assert.ok(ach.earned.some((a) => a.id === 'thirty-day-goal'))
})

// 8. 含今天 29 天 → 不达标
check('boundary: 含今天仅 29 天不达标', () => {
  const dates = range(-28, 0) // 含今天 29 天
  const goals = updateWateringGoal(DEFAULT_GOALS, watering(dates))
  assert.equal(goals[0].completed, false)
  assert.equal(goals[0].progressDays, 29)
})

// 9. 断签两天以上 → broken，带上一段区间
check('broken: 最近记录在 3 天前，state=broken 并给出区间', () => {
  const dates = [isoOffset(-5), isoOffset(-4), isoOffset(-3)]
  const s = getWateringStreakSummary(watering(dates), TODAY)
  assert.equal(s.state, 'broken')
  assert.equal(s.streak, 3)
  assert.equal(s.startDate, isoOffset(-5))
  assert.equal(s.endDate, isoOffset(-3))
  const goals = updateWateringGoal(DEFAULT_GOALS, watering(dates))
  assert.equal(goals[0].progressDays, 3)
  assert.match(goals[0].streakHint, /中断/)
})

// 10. 跨月（今天已浇）
check('cross-month: 09-29~10-01 crossesMonth=true', () => {
  const s = getWateringStreakSummary(watering(['2026-09-29', '2026-09-30', '2026-10-01']), TODAY)
  assert.equal(s.state, 'today')
  assert.equal(s.streak, 3)
  assert.equal(s.crossesMonth, true)
})

// 11. 跨月 + pending
check('cross-month: 09-29、09-30，今天未浇，pending 且跨月', () => {
  const s = getWateringStreakSummary(watering(['2026-09-29', '2026-09-30']), TODAY)
  assert.equal(s.state, 'pending')
  assert.equal(s.streak, 2)
  assert.equal(s.crossesMonth, true)
})

// 12. 未来日期补录不计入
check('future: 只有未来记录时视为 empty', () => {
  const s = getWateringStreakSummary(watering([isoOffset(1), isoOffset(2)]), TODAY)
  assert.equal(s.state, 'empty')
})

// 13. 多株植物同日多条记录只算一天
check('dedup: 同一天多株浇水只计 1 天', () => {
  const records = [
    ...watering([TODAY], 'p1'),
    ...watering([TODAY, isoOffset(-1)], 'p2'),
  ]
  const s = getWateringStreakSummary(records, TODAY)
  assert.equal(s.streak, 2)
})

// 14. 中间断档：今天浇了，前天大前天使，连续只从今天算
check('gap: 09-28、09-29、10-01，今天 streak 只算 1', () => {
  const s = getWateringStreakSummary(watering(['2026-09-28', '2026-09-29', TODAY]), TODAY)
  assert.equal(s.state, 'today')
  assert.equal(s.streak, 1)
})

// 15. 达标后锁定：已 completed，断签后仍然达标（徽章不收回）
check('latch: 已达标后断签，completed 保持 true', () => {
  const latched = [{ ...DEFAULT_GOALS[0], completed: true }]
  const goals = updateWateringGoal(latched, watering([isoOffset(-5)]))
  assert.equal(goals[0].completed, true)
  assert.equal(goals[0].progressDays, 30)
  const ach = calculateAchievements([], watering([isoOffset(-5)]), [], [], goals)
  assert.ok(ach.earned.some((a) => a.id === 'thirty-day-goal'))
})

// 16. pending 当天补记后立即恢复为 today 并达标
check('resume: pending 状态今天补记后变为 today，30 天即达标', () => {
  const dates = range(-30, -1) // 至昨天 30 天
  assert.equal(getWateringStreakSummary(watering(dates), TODAY).state, 'pending')
  const resumed = [...dates, TODAY]
  const goals = updateWateringGoal(DEFAULT_GOALS, watering(resumed))
  assert.equal(getWateringStreakSummary(watering(resumed), TODAY).state, 'today')
  assert.equal(goals[0].completed, true)
})

console.log(`\n全部 ${passed} 项通过 ✅`)
