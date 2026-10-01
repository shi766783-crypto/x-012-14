<script setup>
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

function streakStateLabel(state, completed) {
  if (completed) return '已达标'
  return {
    today: '今日已浇',
    pending: '今日待补记',
    broken: '已断签',
    empty: '未开始',
  }[state] || '未开始'
}

function formatRange(start, end) {
  const fmt = (iso) => iso.replaceAll('-', '/')
  return start === end ? fmt(end) : `${fmt(start)} ~ ${fmt(end)}`
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
      <div class="goal-info">
        <strong>{{ goal.title }}</strong>
        <p>{{ goal.progressDays }} / {{ goal.targetDays }} 天</p>
        <p v-if="goal.streakHint" class="goal-hint">
          <span :class="['streak-tag', goal.completed ? 'streak-tag--completed' : `streak-tag--${goal.streakState || 'empty'}`]">
            {{ streakStateLabel(goal.streakState, goal.completed) }}
          </span>
          {{ goal.streakHint }}
        </p>
        <p v-if="goal.streakStartDate && goal.streak > 0" class="goal-range">
          连续区间 {{ formatRange(goal.streakStartDate, goal.streakEndDate) }}
          <span v-if="goal.crossesMonth" class="cross-month">跨月</span>
        </p>
      </div>
      <progress :max="goal.targetDays" :value="goal.progressDays"></progress>
    </div>
  </section>
</template>
