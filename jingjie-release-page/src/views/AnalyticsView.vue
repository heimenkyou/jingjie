<script setup>
import { computed, onMounted, ref } from 'vue'

const analyticsApiBaseUrl = '/api'
const getDateInputValue = (offset) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

const analyticsToken = ref(sessionStorage.getItem('jingjieAnalyticsAdminToken') || '')
const analyticsTokenDraft = ref(analyticsToken.value)
const analyticsStart = ref(getDateInputValue(-6))
const analyticsEnd = ref(getDateInputValue(0))
const analyticsEvent = ref('page_show')
const analyticsDaily = ref([])
const analyticsPages = ref([])
const analyticsLoading = ref(false)
const analyticsError = ref('')

const analyticsEventOptions = [
  { value: 'page_show', label: '页面访问' },
  { value: 'app_launch', label: '应用启动' },
  { value: 'barcode_add', label: '添加条码' },
  { value: 'station_open_identity_code', label: '打开身份码' },
  { value: 'station_open_home', label: '打开我的驿站' },
  { value: 'feedback_submit', label: '提交反馈' },
]

const analyticsSummary = computed(() => ({
  pv: analyticsDaily.value.reduce((total, item) => total + item.pv, 0),
  dailyUv: analyticsDaily.value.reduce((total, item) => total + item.uv, 0),
  activeDays: analyticsDaily.value.length,
}))

const analyticsDailyMax = computed(() => Math.max(...analyticsDaily.value.map((item) => item.pv), 1))
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(value || 0)

/** 请求管理接口并在令牌失效时给出明确提示。 */
const requestAnalytics = async (path) => {
  const response = await fetch(`${analyticsApiBaseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${analyticsToken.value}`,
    },
  })

  if (response.status === 401) throw new Error('查询令牌无效或已过期')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

/** 加载当前日期范围内的趋势与页面统计数据。 */
const loadAnalytics = async () => {
  if (!analyticsToken.value) {
    analyticsError.value = '请输入查询令牌'
    return
  }

  analyticsLoading.value = true
  analyticsError.value = ''

  try {
    const params = new URLSearchParams({ start: analyticsStart.value, end: analyticsEnd.value })
    const [daily, pages] = await Promise.all([
      requestAnalytics(`/admin/analytics/daily?${params}&event=${analyticsEvent.value}`),
      requestAnalytics(`/admin/analytics/pages?${params}`),
    ])
    analyticsDaily.value = Array.isArray(daily.days) ? daily.days : []
    analyticsPages.value = Array.isArray(pages.pages) ? pages.pages : []
  } catch (error) {
    console.error('加载统计数据失败:', error)
    analyticsError.value = error.message || '暂时无法获取统计数据'
  } finally {
    analyticsLoading.value = false
  }
}

/** 保存当前会话的查询令牌后加载统计数据。 */
const saveAnalyticsToken = async () => {
  analyticsToken.value = analyticsTokenDraft.value.trim()
  if (!analyticsToken.value) {
    analyticsError.value = '请输入查询令牌'
    return
  }

  sessionStorage.setItem('jingjieAnalyticsAdminToken', analyticsToken.value)
  await loadAnalytics()
}

/** 清除当前浏览器会话中的查询令牌和已加载数据。 */
const clearAnalyticsToken = () => {
  sessionStorage.removeItem('jingjieAnalyticsAdminToken')
  analyticsToken.value = ''
  analyticsTokenDraft.value = ''
  analyticsDaily.value = []
  analyticsPages.value = []
  analyticsError.value = ''
}

onMounted(() => {
  if (analyticsToken.value) loadAnalytics()
})
</script>

<template>
  <div class="min-h-screen bg-[#f3f7fa] bg-[url('/images/hero-mobile.webp')] bg-[length:auto_100vh] bg-right-bottom bg-no-repeat bg-fixed text-slate-800 lg:bg-[url('/images/hero-desktop.webp')]">
    <main class="mx-auto w-full max-w-7xl px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
      <section class="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-[0_18px_50px_rgba(36,52,71,0.08)] backdrop-blur sm:p-7">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-center gap-4">
            <div class="grid h-12 w-12 place-items-center rounded-2xl bg-[#3b91a8] text-lg font-bold text-white shadow-sm">净</div>
            <div><p class="text-xs font-bold tracking-[0.2em] text-[#3b91a8]">JINGJIE ANALYTICS</p><h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">数据看板</h1></div>
          </div>
          <div class="flex items-center gap-3 text-sm text-slate-500"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>服务端聚合数据</div>
        </div>
      </section>

      <section v-if="!analyticsToken" class="mx-auto mt-6 max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div class="rounded-2xl bg-[#eef8fa] p-5"><p class="text-sm font-semibold text-[#3b91a8]">受保护的管理页面</p><p class="mt-2 text-sm leading-6 text-slate-600">查询令牌只保留在当前浏览器会话中，关闭标签页后自动清除。</p></div>
        <form class="mt-6" @submit.prevent="saveAnalyticsToken"><label class="block text-sm font-semibold text-slate-700" for="analytics-token">查询令牌</label><input id="analytics-token" v-model="analyticsTokenDraft" type="password" autocomplete="current-password" required class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#3b91a8] focus:bg-white focus:ring-4 focus:ring-[#3b91a8]/10" placeholder="ANALYTICS_ADMIN_TOKEN" /><button type="submit" class="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#3b91a8] px-5 text-sm font-semibold text-white transition hover:bg-[#28798f]">进入数据看板</button></form>
        <p v-if="analyticsError" class="mt-4 text-sm text-rose-600">{{ analyticsError }}</p>
      </section>

      <template v-else>
        <section class="mt-6 rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5"><div class="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_auto_auto] md:items-end"><label class="text-sm font-medium text-slate-600">开始日期<input v-model="analyticsStart" type="date" class="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-700 outline-none focus:border-[#3b91a8]" /></label><label class="text-sm font-medium text-slate-600">结束日期<input v-model="analyticsEnd" type="date" class="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-700 outline-none focus:border-[#3b91a8]" /></label><label class="text-sm font-medium text-slate-600">统计事件<select v-model="analyticsEvent" class="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-700 outline-none focus:border-[#3b91a8]"><option v-for="option in analyticsEventOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><button type="button" :disabled="analyticsLoading" @click="loadAnalytics" class="min-h-11 rounded-xl bg-[#3b91a8] px-5 text-sm font-semibold text-white transition hover:bg-[#28798f] disabled:opacity-60">{{ analyticsLoading ? '加载中' : '刷新数据' }}</button><button type="button" @click="clearAnalyticsToken" class="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">退出</button></div></section>
        <p v-if="analyticsError" class="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ analyticsError }}</p>
        <section class="mt-6 grid gap-4 sm:grid-cols-3"><article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p class="text-sm font-medium text-slate-500">区间 PV</p><p class="mt-3 text-3xl font-bold tracking-tight text-slate-900">{{ formatNumber(analyticsSummary.pv) }}</p><p class="mt-2 text-xs text-slate-400">当前事件的总上报次数</p></article><article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p class="text-sm font-medium text-slate-500">日 UV 累计</p><p class="mt-3 text-3xl font-bold tracking-tight text-slate-900">{{ formatNumber(analyticsSummary.dailyUv) }}</p><p class="mt-2 text-xs text-slate-400">每日去重安装标识之和</p></article><article class="rounded-2xl border border-[#b9dfe6] bg-[#eef8fa] p-5 shadow-sm"><p class="text-sm font-medium text-[#28798f]">活跃天数</p><p class="mt-3 text-3xl font-bold tracking-tight text-[#1d5969]">{{ formatNumber(analyticsSummary.activeDays) }}</p><p class="mt-2 text-xs text-[#28798f]/70">存在统计事件的日期</p></article></section>
        <section class="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]"><article class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div class="flex items-start justify-between gap-4"><div><p class="text-sm font-semibold text-slate-900">访问趋势</p><p class="mt-1 text-sm text-slate-500">柱形高度表示当日 PV</p></div><span class="rounded-full bg-[#eef8fa] px-3 py-1 text-xs font-semibold text-[#28798f]">PV / UV</span></div><div v-if="analyticsLoading" class="grid min-h-56 place-items-center text-sm text-slate-500">正在加载数据...</div><div v-else-if="analyticsDaily.length" class="mt-7 flex min-h-56 min-w-max items-end gap-3 overflow-x-auto pb-2 sm:gap-5"><div v-for="item in analyticsDaily" :key="item.day" class="flex w-12 shrink-0 flex-col items-center gap-2"><span class="text-xs font-semibold text-slate-700">{{ formatNumber(item.pv) }}</span><div class="flex h-36 w-full items-end rounded-t-lg bg-[#eef8fa] px-1"><div class="w-full rounded-t-md bg-gradient-to-t from-[#3b91a8] to-[#76c6d2]" :style="{ height: `${Math.max(8, (item.pv / analyticsDailyMax) * 100)}%` }"></div></div><span class="text-[11px] text-slate-400">{{ item.day.slice(5) }}</span><span class="text-[11px] text-[#28798f]">UV {{ item.uv }}</span></div></div><div v-else class="grid min-h-56 place-items-center text-sm text-slate-500">该日期范围暂无统计数据</div></article><article class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p class="text-sm font-semibold text-slate-900">页面访问排行</p><p class="mt-1 text-sm text-slate-500">页面展示事件按 PV 排序</p><div v-if="analyticsLoading" class="grid min-h-56 place-items-center text-sm text-slate-500">正在加载数据...</div><div v-else-if="analyticsPages.length" class="mt-5 divide-y divide-slate-100"><div v-for="(item, index) in analyticsPages" :key="item.page" class="flex items-center gap-3 py-4 first:pt-0"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#eef8fa] text-xs font-bold text-[#28798f]">0{{ index + 1 }}</span><div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold text-slate-700">{{ item.page }}</p><p class="mt-1 text-xs text-slate-400">UV {{ formatNumber(item.uv) }}</p></div><p class="text-lg font-bold text-slate-900">{{ formatNumber(item.pv) }}</p></div></div><div v-else class="grid min-h-56 place-items-center text-sm text-slate-500">暂无页面访问数据</div></article></section>
      </template>
    </main>
  </div>
</template>
