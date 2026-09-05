<script setup>
import { computed, onMounted, ref } from 'vue'

const feedbackApiUrl = 'https://jingjie.luowb.cn/hooks/jingjie-feedback-view'
const feedbackItems = ref([])
const feedbackLoading = ref(false)
const feedbackError = ref('')
const feedbackCountText = computed(() => (feedbackLoading.value ? '正在加载反馈...' : feedbackError.value ? '加载失败' : `共 ${feedbackItems.value.length} 条反馈`))

/** 拉取已有的用户反馈。 */
const loadFeedback = async () => {
  feedbackLoading.value = true
  feedbackError.value = ''
  try {
    const response = await fetch(feedbackApiUrl, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    feedbackItems.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('加载反馈失败:', error)
    feedbackError.value = '暂时无法获取反馈，请稍后再试。'
  } finally {
    feedbackLoading.value = false
  }
}

onMounted(loadFeedback)
</script>

<template>
  <div class="min-h-screen bg-[#f3f7fa] text-slate-800"><main class="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10"><section class="flex flex-col gap-8"><div class="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><a href="#/" class="text-sm font-medium text-[#3b91a8]">返回发布页</a><p class="mt-4 text-sm font-medium text-slate-500">内部查看页</p><h1 class="mt-2 text-3xl font-semibold text-slate-900">反馈列表</h1><p class="mt-3 text-sm leading-6 text-slate-600">从反馈接口拉取最新反馈，默认按接口返回顺序展示。</p></div><div class="flex flex-col items-start gap-3 sm:items-end"><p class="text-sm text-slate-500">{{ feedbackCountText }}</p><button type="button" class="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60" :disabled="feedbackLoading" @click="loadFeedback">{{ feedbackLoading ? '刷新中...' : '刷新反馈' }}</button></div></div><div v-if="feedbackError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ feedbackError }}</div><div v-else-if="feedbackLoading" class="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">正在加载反馈...</div><div v-else-if="feedbackItems.length === 0" class="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">暂无反馈数据</div><div v-else class="grid gap-4"><article v-for="item in feedbackItems" :key="`${item.timestamp}-${item.contact}-${item.content}`" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div class="flex flex-wrap gap-2 text-sm"><span class="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">{{ item.version || '未填写版本' }}</span><span class="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">{{ item.contact || '未填写联系方式' }}</span></div><p class="text-sm text-slate-500">{{ item.timestamp }}</p></div><p class="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{{ item.content }}</p></article></div></section></main></div>
</template>
