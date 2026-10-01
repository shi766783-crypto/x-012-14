import { ACHIEVEMENTS } from '../constants/garden'
import { daysBetween, monthOf, shiftISODate, todayISO } from '../utils/date'

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getWateringStatus(plant, today = todayISO()) {
  const lastWatered = plant.lastWateredDate || plant.purchaseDate || today
  const elapsed = daysBetween(lastWatered, today)
  const frequency = Number(plant.wateringFrequency) || 1

  if (elapsed === 0) return '已浇水'
  if (elapsed < frequency) return '已浇水'
  if (elapsed === frequency) return '待浇水'
  return '已过期'
}

export function getDueWateringPlants(plants, today = todayISO()) {
  return plants
    .map((plant) => ({ ...plant, wateringStatus: getWateringStatus(plant, today) }))
    .filter((plant) => plant.wateringStatus === '待浇水' || plant.wateringStatus === '已过期')
    .sort((a, b) => statusWeight(b.wateringStatus) - statusWeight(a.wateringStatus))
}

export function getDashboard(plants, careRecords, growthRecords) {
  const currentMonth = monthOf(todayISO())
  const alivePlants = plants.filter((plant) => plant.alive !== false)
  const duePlants = getDueWateringPlants(plants)
  const monthlyFertilizing = careRecords.filter(
    (record) => record.type === '施肥' && monthOf(record.date) === currentMonth,
  ).length
  const survivalRate = plants.length ? Math.round((alivePlants.length / plants.length) * 100) : 100
  const averageScore = calculateAverageCareScore(plants, careRecords, growthRecords)

  return {
    totalPlants: plants.length,
    dueWatering: duePlants.length,
    monthlyFertilizing,
    survivalRate,
    averageScore,
  }
}

export function buildTimeline(plantId, careRecords, growthRecords, pestRecords) {
  const careItems = careRecords
    .filter((record) => record.plantId === plantId)
    .map((record) => ({
      id: record.id,
      date: record.date,
      title: record.type,
      detail: record.note || record.amount || '已记录养护操作',
      photo: record.photo,
    }))
  const growthItems = growthRecords
    .filter((record) => record.plantId === plantId)
    .map((record) => ({
      id: record.id,
      date: record.date,
      title: '生长指标',
      detail: `高度 ${record.height || 0} cm，叶片 ${record.leafCount || 0} 片，${record.bloomState}`,
    }))
  const pestItems = pestRecords
    .filter((record) => record.plantId === plantId)
    .map((record) => ({
      id: record.id,
      date: record.date,
      title: '病虫害记录',
      detail: `${record.symptom}；${record.recovery || '恢复情况待观察'}`,
    }))

  return [...careItems, ...growthItems, ...pestItems].sort((a, b) => b.date.localeCompare(a.date))
}

export function calculateAchievements(plants, careRecords, growthRecords, pestRecords, goals) {
  const wateringCount = careRecords.filter((record) => record.type === '浇水').length
  const fertilizingCount = careRecords.filter((record) => record.type === '施肥').length
  const bloomingPlants = new Set(
    growthRecords.filter((record) => record.bloomState === '盛开').map((record) => record.plantId),
  ).size
  const dashboard = getDashboard(plants, careRecords, growthRecords)
  const earnedIds = new Set()

  if (plants.length >= 1) earnedIds.add('first-plant')
  if (plants.length >= 5) earnedIds.add('plant-five')
  if (plants.length >= 10) earnedIds.add('plant-ten')
  if (dashboard.averageScore >= 80) earnedIds.add('green-thumb')
  if (wateringCount >= 5) earnedIds.add('watering-rookie')
  if (wateringCount >= 20) earnedIds.add('watering-master')
  if (fertilizingCount >= 5) earnedIds.add('fertilizer-care')
  if (bloomingPlants >= 3) earnedIds.add('bloom-garden')
  if (growthRecords.length >= 10) earnedIds.add('growth-watcher')
  if (pestRecords.length >= 3) earnedIds.add('plant-doctor')
  if (goals.some((goal) => goal.completed || goal.progressDays >= goal.targetDays)) earnedIds.add('thirty-day-goal')

  const provisionalPoints = ACHIEVEMENTS.filter((item) => earnedIds.has(item.id)).reduce(
    (sum, item) => sum + item.points,
    0,
  )
  if (provisionalPoints >= 180) earnedIds.add('garden-master')

  const earned = ACHIEVEMENTS.filter((item) => earnedIds.has(item.id))
  const points = earned.reduce((sum, item) => sum + item.points, 0)

  return { earned, points }
}

export function updateWateringGoal(goals, careRecords) {
  const wateringDates = careRecords.filter((record) => record.type === '浇水').map((record) => record.date)
  const streakInfo = getWateringStreak(wateringDates)

  return goals.map((goal) => {
    if (goal.id !== 'goal-30-watering') return goal
    return {
      ...goal,
      progressDays: Math.min(streakInfo.streak, goal.targetDays),
      // 30 天达标只认真实连续记录：必须累计满 targetDays 个有浇水的日子，
      // “今天还没浇”的宽限状态只用于展示，不会提前判定完成。
      completed: streakInfo.streak >= goal.targetDays,
      streak: streakInfo,
    }
  })
}

export function buildLeaderboards(plants, careRecords, growthRecords) {
  const groups = plants.map((plant) => {
    const plantCare = careRecords.filter((record) => record.plantId === plant.id)
    const plantGrowth = growthRecords.filter((record) => record.plantId === plant.id)
    const completeness = Math.min(100, plantCare.length * 8 + plantGrowth.length * 10)
    const survival = plant.alive === false ? 0 : 100
    return {
      id: plant.id,
      name: plant.name,
      score: Math.round(survival * 0.6 + completeness * 0.4),
      blooms: plantGrowth.filter((record) => record.bloomState === '盛开').length,
    }
  })

  return {
    gardenExperts: [...groups].sort((a, b) => b.score - a.score).slice(0, 5),
    bloomLeaders: [...groups].sort((a, b) => b.blooms - a.blooms).slice(0, 5),
  }
}

function calculateAverageCareScore(plants, careRecords, growthRecords) {
  if (!plants.length) return 100
  const scores = plants.map((plant) => {
    const status = getWateringStatus(plant)
    const statusScore = status === '已过期' ? 45 : status === '待浇水' ? 75 : 95
    const recordScore = Math.min(100, careRecords.filter((record) => record.plantId === plant.id).length * 12)
    const growthScore = Math.min(100, growthRecords.filter((record) => record.plantId === plant.id).length * 18)
    return Math.round(statusScore * 0.55 + recordScore * 0.3 + growthScore * 0.15)
  })
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

/**
 * 计算当前连续浇水进度。
 *
 * 口径：连续链以“今天”或“昨天”为起点——今天还没浇水但昨天有记录时，
 * 仍保留截至昨天的连续天数（waitingToday=true，仅展示用，今天浇上即续上）；
 * 昨天也没有记录则视为中断，进度清零。补录的未来日期不参与计算。
 *
 * @param {string[]} wateringDates 全部浇水记录的日期（允许重复、乱序）
 * @param {string} [today] 注入当天日期，便于测试
 * @returns {{
 *   streak: number,
 *   startDate: string,
 *   lastDate: string,
 *   recordedToday: boolean,
 *   waitingToday: boolean,
 *   crossMonth: boolean,
 *   gapDate: string,
 * }}
 */
export function getWateringStreak(wateringDates, today = todayISO()) {
  // 补录误选未来日期会被算成“今天已浇”，这里统一剔除，保证判定边界不被污染。
  const dates = new Set(wateringDates.filter((date) => date && date <= today))
  const yesterday = shiftISODate(today, -1)

  const empty = {
    streak: 0,
    startDate: '',
    lastDate: '',
    recordedToday: false,
    waitingToday: false,
    crossMonth: false,
    gapDate: '',
  }
  if (!dates.size) return empty

  const recordedToday = dates.has(today)
  const waitingToday = !recordedToday && dates.has(yesterday)
  // 昨天也没记录即已中断；起点之前更早的记录不能续接当前进度。
  if (!recordedToday && !waitingToday) {
    const latest = [...dates].sort().at(-1) || ''
    // 断档恰好只有昨天一天时，补录昨天还能把链条接上，提示用户。
    const canBackfill = latest === shiftISODate(today, -2)
    return { ...empty, lastDate: latest, gapDate: canBackfill ? yesterday : '' }
  }

  let cursor = recordedToday ? today : yesterday
  const lastDate = cursor
  let streak = 0

  while (dates.has(cursor)) {
    streak += 1
    cursor = shiftISODate(cursor, -1)
  }

  // cursor 停在链条起点的前一天，起点再往回一天
  const startDate = shiftISODate(cursor, 1)

  return {
    streak,
    startDate,
    lastDate,
    recordedToday,
    waitingToday,
    crossMonth: startDate.slice(0, 7) !== lastDate.slice(0, 7),
    gapDate: '',
  }
}

function statusWeight(status) {
  return status === '已过期' ? 2 : status === '待浇水' ? 1 : 0
}
