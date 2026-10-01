const DAY_MS = 24 * 60 * 60 * 1000

export function todayISO() {
  return toISODate(new Date())
}

export function toISODate(date) {
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

export function daysBetween(startISO, endISO = todayISO()) {
  if (!startISO) return 0
  const [startYear, startMonth, startDay] = startISO.split('-').map((part) => Number(part))
  const [endYear, endMonth, endDay] = endISO.split('-').map((part) => Number(part))
  const start = Date.UTC(startYear, startMonth - 1, startDay)
  const end = Date.UTC(endYear, endMonth - 1, endDay)
  return Math.round((end - start) / DAY_MS)
}

export function shiftISODate(dateISO, offsetDays) {
  const [year, month, day] = dateISO.split('-').map((part) => Number(part))
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays))
  return shifted.toISOString().slice(0, 10)
}

export function yesterdayISO(baseISO = todayISO()) {
  return shiftISODate(baseISO, -1)
}

export function monthOf(dateISO) {
  return dateISO?.slice(0, 7) || ''
}

export function formatDate(dateISO) {
  if (!dateISO) return '未记录'
  return dateISO.replaceAll('-', '/')
}

export function formatShortDate(dateISO) {
  if (!dateISO) return '未记录'
  return Number(dateISO.slice(5, 7)) + '/' + Number(dateISO.slice(8, 10))
}

export function formatRange(startISO, endISO) {
  if (startISO === endISO) return formatShortDate(startISO)
  return `${formatShortDate(startISO)} - ${formatShortDate(endISO)}`
}
