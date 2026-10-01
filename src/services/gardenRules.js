import { ACHIEVEMENTS } from '../constants/garden'
import { daysBetween, formatDate, monthOf, shiftDateISO, todayISO } from '../utils/date'

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
  // 30 天徽章以目标 completed 为准：必须含今天在内连续达标，宽限展示的进度不会提前点亮徽章。
  if (goals.some((goal) => goal.id === 'goal-30-watering' && goal.completed)) earnedIds.add('thirty-day-goal')

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
  const summary = getWateringStreakSummary(careRecords)

  return goals.map((goal) => {
    if (goal.id !== 'goal-30-watering') return goal
    // 30 天达标只认“含今天在内的连续记录”：今天没浇水则进度仍可读但不判定达标。
    // 一旦达标即锁定，之后断签不再收回徽章，只在提示中展示当前实际连续情况。
    const completed = goal.completed === true || (summary.recordedToday && summary.streak >= goal.targetDays)
    return {
      ...goal,
      streak: summary.streak,
      progressDays: completed ? goal.targetDays : Math.min(summary.streak, goal.targetDays),
      completed,
      streakState: summary.state,
      streakStartDate: summary.startDate,
      streakEndDate: summary.endDate,
      streakHint: buildStreakHint(summary, goal.targetDays, completed),
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

// 连续浇水进度口径：
// - today   今天已记录：从今天往回连续计数；
// - pending 今天未记录但昨天有记录（含补录）：保留昨天为止的连续进度，不清零，提示今天补记；
// - broken  最近记录已断签两天及以上：连续中断，展示上一段连续区间便于用户交代去向；
// - empty   从未有过浇水记录：明确提示起点，不显示 0 天这样的“无故归零”。
// 未来日期的补录不计入（以今天为锚点）。
export function getWateringStreakSummary(careRecords, today = todayISO()) {
  const yesterday = shiftDateISO(today, -1)
  const dates = new Set(
    careRecords
      .filter((record) => record.type === '浇水' && record.date && record.date <= today)
      .map((record) => record.date),
  )

  if (dates.size === 0) {
    return { streak: 0, state: 'empty', startDate: '', endDate: '', recordedToday: false }
  }

  const recordedToday = dates.has(today)
  let state
  let anchor
  if (recordedToday) {
    state = 'today'
    anchor = today
  } else if (dates.has(yesterday)) {
    state = 'pending'
    anchor = yesterday
  } else {
    state = 'broken'
    anchor = [...dates].sort().reverse().find((date) => date <= yesterday)
  }

  let endDate = anchor
  let cursor = anchor
  let streak = 0
  while (cursor && dates.has(cursor)) {
    endDate = cursor
    streak += 1
    cursor = shiftDateISO(cursor, -1)
  }

  return {
    streak,
    state,
    startDate: endDate,
    endDate: anchor,
    recordedToday,
    // today/pending：连续起点与今天是否跨月；broken：展示的上一段区间自身是否跨月。
    crossesMonth:
      state === 'broken'
        ? monthOf(endDate) !== monthOf(anchor)
        : monthOf(endDate) !== monthOf(today),
  }
}

function buildStreakHint(summary, targetDays, completed) {
  if (completed) {
    return summary.recordedToday
      ? `已连续浇水 ${summary.streak} 天，达成 ${targetDays} 天目标。`
      : `已达成 ${targetDays} 天目标；今天还没浇水，记录后继续延续连续进度。`
  }
  switch (summary.state) {
    case 'empty':
      return '还没有浇水记录，今天记下第一次浇水即可开启连续进度。'
    case 'pending':
      if (summary.streak >= targetDays) {
        return `已连续 ${summary.streak} 天（至昨天），今天补记浇水即可点亮 ${targetDays} 天徽章。`
      }
      return `今天还没浇水，已保留截至昨天的连续 ${summary.streak} 天，今天补记即可延续。`
    case 'broken': {
      const range =
        summary.startDate === summary.endDate
          ? formatDate(summary.endDate)
          : `${formatDate(summary.startDate)} 至 ${formatDate(summary.endDate)}`
      return `连续进度已中断，上一段连续 ${summary.streak} 天（${range}），今天浇水重新开始计数。`
    }
    default:
      if (summary.streak >= targetDays) {
        return `已连续 ${summary.streak} 天，达成 ${targetDays} 天目标。`
      }
      return `已连续浇水 ${summary.streak} 天，再坚持 ${targetDays - summary.streak} 天达成 ${targetDays} 天目标。`
  }
}

function statusWeight(status) {
  return status === '已过期' ? 2 : status === '待浇水' ? 1 : 0
}
