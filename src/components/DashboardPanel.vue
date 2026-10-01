<script setup>
import { formatDate, formatRange, formatShortDate } from '../utils/date'

defineProps({
  dashboard: {
    type: Object,
    required: true,
  },
  goals: {
    type: Array,
    required: true,
  },
  achievements: {
    type: Object,
    required: true,
  },
})

function streakMeta(goal) {
  return goal.streak || {}
}

function streakHint(goal) {
  const info = streakMeta(goal)
  if (info.streak === undefined) return ''

  if (goal.completed) return '已达成连续目标，之后中断也不会收回这枚徽章。'
  if (info.streak === 0) {
    if (info.gapDate) {
      return `链条已中断：${formatDate(info.gapDate)} 空缺，在养护记录里把日期选为 ${formatShortDate(info.gapDate)} 补录浇水即可接上，今天再记一次就完整续上。`
    }
    if (info.lastDate) return `最近一次浇水是 ${formatDate(info.lastDate)}，链条已中断，今天浇水重新开始计数。`
    return '还没有浇水记录，今天记下第一次浇水，开始你的连续进度。'
  }

  const rangeText = formatRange(info.startDate, info.lastDate)
  const crossMonth = info.crossMonth
    ? `连续进度已跨 ${Number(info.startDate.slice(5, 7))} 月与 ${Number(info.lastDate.slice(5, 7))} 月，按实际日期连续判定，不受自然月清零影响。`
    : ''
  if (info.waitingToday) {
    return `连续 ${info.streak} 天（${rangeText}），今天还没浇水；今日补记即可续上，跨过今天仍未记录则进度清零。${crossMonth}`
  }
  return `连续 ${info.streak} 天（${rangeText}），今天已浇水，保持节奏。${crossMonth}`
}

function statusText(goal) {
  const info = streakMeta(goal)
  if (goal.completed) return '已达标'
  if (info.waitingToday) return '待今日补记'
  if (info.recordedToday) return '今日已记录'
  if (info.streak > 0) return '进行中'
  return info.gapDate ? '可补录接续' : '未开始'
}
</script>

<template>
  <section class="dashboard">
    <article class="metric">
      <span>植物总数</span>
      <strong>{{ dashboard.totalPlants }}</strong>
    </article>
    <article class="metric urgent">
      <span>今日待浇水</span>
      <strong>{{ dashboard.dueWatering }}</strong>
    </article>
    <article class="metric">
      <span>本月施肥</span>
      <strong>{{ dashboard.monthlyFertilizing }}</strong>
    </article>
    <article class="metric">
      <span>存活率</span>
      <strong>{{ dashboard.survivalRate }}%</strong>
    </article>
    <article class="metric">
      <span>平均养护评分</span>
      <strong>{{ dashboard.averageScore }}</strong>
    </article>
    <article class="metric achievement-score">
      <span>成就积分</span>
      <strong>{{ achievements.points }}</strong>
    </article>
  </section>

  <section class="panel goal-panel">
    <div class="panel-heading">
      <h2>养护目标</h2>
      <span>{{ achievements.earned.length }} / 12 枚徽章</span>
    </div>
    <div v-for="goal in goals" :key="goal.id" class="goal-row">
      <div>
        <strong>{{ goal.title }}</strong>
        <p>{{ goal.progressDays }} / {{ goal.targetDays }} 天</p>
        <small class="streak-hint">{{ streakHint(goal) }}</small>
      </div>
      <div class="goal-progress">
        <span :class="['status-pill', goal.completed ? 'ok' : 'warning']">{{ statusText(goal) }}</span>
        <progress :max="goal.targetDays" :value="goal.progressDays"></progress>
      </div>
    </div>
  </section>
</template>
