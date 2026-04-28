<template>
	<view class="notice-bar" v-if="visibleNotice" :style="barStyle">
		<view class="notice-main" @click="handleNoticeClick">
			<text class="notice-tag" :class="`notice-tag-${visibleNotice.level || 'info'}`">公告</text>
			<view class="notice-marquee">
				<view class="notice-track" :style="trackStyle">
					<text class="notice-text">{{ visibleNotice.content }}</text>
				</view>
			</view>
		</view>
		<text
			v-if="visibleNotice.allowDismiss"
			class="notice-close"
			@click.stop="handleDismiss"
		>
			×
		</text>
	</view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { dismissGlobalNotice, loadGlobalNotices, subscribeNoticePlayback, syncNoticePlayback } from '@/utils/notices.js';

const props = defineProps({
	bottom: {
		type: [Number, String],
		default: 0
	},
	zIndex: {
		type: Number,
		default: 80
	}
});

const notices = ref([]);
const currentIndex = ref(0);
const trackStyle = ref({});
const playbackState = ref({
	index: 0,
	startedAt: 0,
	durationMs: 5000
});
let unsubscribePlayback = null;

const barStyle = computed(() => ({
	bottom: typeof props.bottom === 'number' ? `${props.bottom}px` : props.bottom,
	zIndex: String(props.zIndex)
}));

const visibleNotice = computed(() => {
	if (!notices.value.length) return null;
	return notices.value[currentIndex.value] || notices.value[0];
});

const instance = getCurrentInstance();

const startPlayback = async () => {
	if (!visibleNotice.value) return;

	trackStyle.value = {
		transform: 'translate3d(0, 0, 0)',
		transition: 'none'
	};
	await nextTick();

	const elapsedMs = Math.max(0, Date.now() - (playbackState.value.startedAt || 0));
	const query = uni.createSelectorQuery().in(instance?.proxy);
	const rects = await new Promise((resolve) => {
		query
			.select('.notice-marquee')
			.boundingClientRect()
			.select('.notice-track')
			.boundingClientRect()
			.exec((res) => resolve(res || []));
	});

	const marqueeWidth = rects?.[0]?.width || 0;
	const trackWidth = rects?.[1]?.width || 0;
	const overflowWidth = Math.max(0, trackWidth - marqueeWidth);

	if (!overflowWidth) {
		trackStyle.value = {
			transform: 'translate3d(0, 0, 0)',
			transition: 'none'
		};
		return;
	}

	const holdBeforeMs = 1200;
	const holdAfterMs = 1000;
	const pixelsPerSecond = 24;
	const scrollDurationMs = Math.max(
		6000,
		playbackState.value.durationMs - holdBeforeMs - holdAfterMs,
		Math.round((overflowWidth / pixelsPerSecond) * 1000)
	);
	const scrollStartedAt = holdBeforeMs;
	const scrollEndedAt = holdBeforeMs + scrollDurationMs;

	if (elapsedMs <= scrollStartedAt) {
		trackStyle.value = {
			transform: 'translate3d(0, 0, 0)',
			transition: 'none'
		};
		return;
	}

	if (elapsedMs >= scrollEndedAt) {
		trackStyle.value = {
			transform: `translate3d(-${overflowWidth}px, 0, 0)`,
			transition: 'none'
		};
		return;
	}

	const scrolledRatio = (elapsedMs - scrollStartedAt) / scrollDurationMs;
	const currentOffset = overflowWidth * scrolledRatio;
	const remainingDurationMs = Math.max(16, scrollEndedAt - elapsedMs);

	trackStyle.value = {
		transform: `translate3d(-${currentOffset}px, 0, 0)`,
		transition: 'none'
	};
	await nextTick();
	trackStyle.value = {
		transform: `translate3d(-${overflowWidth}px, 0, 0)`,
		transition: `transform ${remainingDurationMs}ms linear`
	};
};

const refreshNotices = async () => {
	const payload = await loadGlobalNotices();
	if (!payload.globalEnable) {
		notices.value = [];
		trackStyle.value = {};
		return;
	}

	notices.value = payload.items || [];
	const state = syncNoticePlayback(notices.value);
	playbackState.value = state;
	currentIndex.value = state.index;
	await nextTick();
	startPlayback();
};

const openNoticeLink = (link) => {
	if (!link) return;

	if (link === 'jingjie://page/settings') {
		uni.switchTab({
			url: '/pages/settings/index'
		});
		return;
	}

	// #ifdef APP-PLUS
	if (typeof plus !== 'undefined' && plus.runtime?.openURL) {
		plus.runtime.openURL(link);
		return;
	}
	// #endif

	// #ifdef H5
	window.location.href = link;
	// #endif
};

const handleNoticeClick = () => {
	if (!visibleNotice.value?.link) return;
	openNoticeLink(visibleNotice.value.link);
};

const handleDismiss = async () => {
	if (!visibleNotice.value?.allowDismiss) return;
	const currentId = visibleNotice.value.id;
	dismissGlobalNotice(currentId);
	await refreshNotices();
};

onShow(() => {
	refreshNotices();
});

unsubscribePlayback = subscribeNoticePlayback((state) => {
	playbackState.value = state;
	currentIndex.value = state.index;
	startPlayback();
});

onBeforeUnmount(() => {
	if (unsubscribePlayback) {
		unsubscribePlayback();
		unsubscribePlayback = null;
	}
});
</script>

<style scoped>
.notice-bar {
	position: fixed;
	left: 12px;
	right: 12px;
	height: 32px;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 0 10px;
	border-radius: 12px;
	background: rgba(255, 255, 255, 0.96);
	box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
	border: 1px solid rgba(15, 23, 42, 0.06);
	overflow: hidden;
}

.notice-main {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 8px;
	overflow: hidden;
}

.notice-tag {
	flex-shrink: 0;
	padding: 3px 8px;
	border-radius: 999px;
	font-size: 11px;
	font-weight: 700;
	color: #fff;
}

.notice-tag-info {
	background: #10b981;
}

.notice-tag-warn {
	background: #f59e0b;
}

.notice-tag-error {
	background: #ef4444;
}

.notice-marquee {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	height: 18px;
	display: flex;
	align-items: center;
}

.notice-track {
	display: inline-flex;
	align-items: center;
	white-space: nowrap;
	transform: translate3d(0, 0, 0);
	will-change: transform;
}

.notice-text {
	display: inline-block;
	font-size: 13px;
	color: #0f172a;
	white-space: nowrap;
	word-break: keep-all;
}

.notice-close {
	flex-shrink: 0;
	width: 22px;
	height: 22px;
	line-height: 22px;
	text-align: center;
	border-radius: 50%;
	background: rgba(15, 23, 42, 0.06);
	color: #64748b;
	font-size: 14px;
}
</style>
