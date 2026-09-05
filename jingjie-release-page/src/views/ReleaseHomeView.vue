<script setup>
import { computed, onMounted, ref } from 'vue'

const directDownloadUrl = 'https://gitee.com/heimenkyou/jingjie/releases/download/v2.2.0/JingJie_v2.2.0.apk'
const downloadApiUrl = '/api/downloads'
const versionName = 'v2.2.0'
const isAutoDownloading = ref(false)
const downloadCount = ref('')
const downloadCountLoading = ref(false)
const hasTriggeredDownload = ref(false)

const sourceLinks = [
  { label: 'GitHub', href: 'https://github.com/heimenkyou/jingjie' },
  { label: 'Gitee', href: 'https://gitee.com/heimenkyou/jingjie' },
]

const previewScreenshots = [
  { title: '本地条码', src: 'https://img.luowb.cn/posts/2026/04/30/c82467d84b80f390541faa18e7849f2e-条码页.webp' },
  { title: '驿站', src: 'https://img.luowb.cn/posts/2026/09/05/f06fd443f17c650b366879d6ff7df6e3-驿站跳转.webp' },
  { title: '设置', src: 'https://img.luowb.cn/posts/2026/09/05/bc5f5ec4fb166d1b1696fe5ff9fa3903-设置.webp' },
]

const coreFeatures = [
  { title: '本地条码', body: '截图存本地，打开直接用。' },
  { title: '驿站直达', body: '直接跳转淘宝身份码或我的驿站。' },
  { title: '默认打开', body: '设置启动页和驿站自动跳转。' },
]

const downloadCountText = computed(() => (downloadCountLoading.value && !downloadCount.value ? '...' : downloadCount.value || '--'))

/** 获取累计下载次数。 */
const loadDownloadCount = async () => {
  downloadCountLoading.value = true
  try {
    const response = await fetch(downloadApiUrl, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    downloadCount.value = data?.count !== undefined ? String(data.count) : ''
  } catch (error) {
    console.error('获取下载量失败:', error)
  } finally {
    downloadCountLoading.value = false
  }
}

/** 增加下载次数后跳转至 APK 文件。 */
const triggerDownload = async () => {
  if (hasTriggeredDownload.value) return
  hasTriggeredDownload.value = true

  try {
    const response = await fetch(downloadApiUrl, { method: 'POST', headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    downloadCount.value = typeof data?.count !== 'undefined' ? String(data.count) : downloadCount.value
  } catch (error) {
    console.error('上报下载量失败:', error)
  }

  window.location.href = directDownloadUrl
}

/** 处理下载链接点击，避免浏览器提前跳转。 */
const handleDownloadClick = async (event) => {
  event.preventDefault()
  await triggerDownload()
}

/** 兼容旧下载链接中的自动下载参数。 */
const handleAutoDownload = () => {
  const url = new URL(window.location.href)
  if (url.searchParams.get('action') !== 'autodownload') return

  isAutoDownloading.value = true
  url.searchParams.delete('action')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  window.setTimeout(triggerDownload, 600)
}

onMounted(() => {
  loadDownloadCount()
  handleAutoDownload()
})
</script>

<template>
  <div class="min-h-screen overflow-x-hidden bg-[#f3f7fa] bg-[url('/images/hero-mobile.webp')] bg-[length:auto_100vh] bg-right-bottom bg-no-repeat bg-fixed text-slate-800 lg:bg-[url('/images/hero-desktop.webp')] lg:bg-[length:auto_100vh] lg:bg-right-bottom">
    <main class="mx-auto min-w-0 w-full max-w-7xl overflow-x-hidden px-5 py-8 sm:px-8 lg:px-10">
      <section class="grid min-h-[78svh] min-w-0 items-center gap-12 py-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10 lg:py-12 xl:grid-cols-[0.76fr_1.24fr]">
        <div class="min-w-0 text-center lg:text-left">
          <div class="flex items-center justify-center gap-4 lg:justify-start"><img src="/logo.webp" alt="净界 Logo" class="h-16 w-16 rounded-2xl border border-slate-200 bg-white object-cover shadow-sm" /><p class="text-sm font-semibold tracking-[0.18em] text-emerald-700">JINGJIE</p></div>
          <h1 class="mt-8 text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-5xl xl:text-6xl">校园出码，<br class="hidden lg:block" />更快一点</h1>
          <p class="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 lg:mx-0 sm:text-lg">本地条码 · 淘宝身份码 · 我的驿站</p>
          <div class="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start"><a :href="directDownloadUrl" class="inline-flex min-h-12 items-center justify-center rounded-xl border border-emerald-900 bg-emerald-800 px-7 text-sm font-semibold !text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-900" @click="handleDownloadClick">立即下载 APK（{{ versionName }}）</a><a v-for="link in sourceLinks" :key="link.label" :href="link.href" target="_blank" rel="noreferrer" class="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white/70 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white">{{ link.label }}</a></div>
          <div v-if="isAutoDownloading" class="mx-auto mt-5 w-full max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center lg:mx-0"><p class="text-base font-semibold text-emerald-900">正在为你准备下载，请稍等</p><p class="mt-1 text-xs text-emerald-800/80">如果没有自动开始下载，可以手动点击上方下载按钮。</p></div>
          <p class="mt-6 text-sm text-slate-500">Android · {{ versionName }} · arm64-v8a · 累计下载 {{ downloadCountText }} 次</p>
        </div>
        <div class="relative mx-auto min-w-0 w-full max-w-full overflow-hidden lg:h-[640px] lg:max-w-[900px] lg:overflow-visible"><div class="absolute inset-x-8 top-10 h-4/5 rounded-full bg-emerald-300/30 blur-3xl"></div><div class="relative flex w-full max-w-full snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-1 pb-8 sm:gap-5 sm:px-2 lg:block lg:h-full lg:overflow-visible lg:px-0 lg:pb-0"><figure v-for="(item, index) in previewScreenshots" :key="item.title" class="w-[82%] max-w-[280px] shrink-0 snap-center overflow-hidden rounded-[1.6rem] border border-slate-200/90 bg-white p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.16)] sm:w-[46%] sm:max-w-[300px] sm:rounded-[2rem] sm:p-2 lg:absolute lg:w-[42%] lg:max-w-none" :class="index === 0 ? 'lg:bottom-8 lg:left-2 lg:rotate-[-9deg]' : index === 1 ? 'lg:left-[29%] lg:top-2 lg:z-10' : 'lg:right-1 lg:top-20 lg:w-[34%] lg:rotate-[8deg]'"><div class="overflow-hidden rounded-[1.05rem] bg-slate-100 sm:rounded-[1.55rem]"><img :src="item.src" :alt="`净界 ${item.title}界面`" class="aspect-[9/19.5] h-full w-full object-cover object-top" :loading="index === 1 ? 'eager' : 'lazy'" /></div><figcaption class="px-1 py-2 text-center text-[11px] font-medium text-slate-600 sm:py-3 sm:text-sm">{{ item.title }}</figcaption></figure></div></div>
      </section>
      <section class="border-t border-slate-200/80 py-14 sm:py-16"><div class="mx-auto max-w-2xl text-center"><p class="text-sm font-semibold tracking-[0.18em] text-emerald-700">CORE FEATURES</p><h2 class="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">只保留真正会用到的功能</h2><p class="mt-3 text-sm leading-6 text-slate-600">面向校园生活里的高频入口，减少等待和跳转。</p></div><div class="mt-9 grid gap-4 md:grid-cols-3"><article v-for="(item, index) in coreFeatures" :key="item.title" class="rounded-2xl border border-slate-200 bg-white/85 p-6 text-left shadow-sm"><span class="text-sm font-semibold text-emerald-700">0{{ index + 1 }}</span><h3 class="mt-4 text-lg font-semibold text-slate-900">{{ item.title }}</h3><p class="mt-3 text-sm leading-7 text-slate-600">{{ item.body }}</p></article></div></section>
      <footer class="border-t border-slate-200/80 py-8 text-center"><p class="text-sm font-medium text-slate-700">Open source. Built with Uni-app + Vue 3.</p><div class="mt-4 flex flex-wrap justify-center gap-3"><a href="https://gitee.com/heimenkyou/jingjie/releases" target="_blank" rel="noreferrer" class="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white">查看发布记录</a><a href="#/feedback" class="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white">反馈列表</a><a href="#/analytics" class="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#3b91a8] px-4 text-sm font-semibold text-white transition hover:bg-[#28798f]">数据看板</a></div></footer>
    </main>
  </div>
</template>
