<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AnalyticsView from './views/AnalyticsView.vue'
import FeedbackView from './views/FeedbackView.vue'
import ReleaseHomeView from './views/ReleaseHomeView.vue'

const currentView = ref('home')

const resolveView = () => {
  const hash = window.location.hash.toLowerCase()
  const pathname = window.location.pathname.toLowerCase()

  if (hash === '#/analytics' || pathname.endsWith('/analytics')) return 'analytics'
  if (hash === '#/feedback' || pathname.endsWith('/feedback')) return 'feedback'
  return 'home'
}

const currentComponent = computed(() => ({
  home: ReleaseHomeView,
  feedback: FeedbackView,
  analytics: AnalyticsView,
}[currentView.value]))

const updateCurrentView = () => {
  currentView.value = resolveView()
}

onMounted(() => {
  updateCurrentView()
  window.addEventListener('hashchange', updateCurrentView)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', updateCurrentView)
})
</script>

<template>
  <component :is="currentComponent" />
</template>
