<template>
	<view class="notice-bar" v-if="visibleNotice" :style="barStyle">
		<view class="notice-main" @click="handleNoticeClick">
			<text class="notice-tag" :class="`notice-tag-${visibleNotice.level || 'info'}`">公告</text>
			<view class="notice-marquee">
				<view class="notice-track" :key="`${visibleNotice.id}-${animationSeed}`">
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { dismissGlobalNotice, loadGlobalNotices } from '@/utils/notices.js';

const props = defineProps({
	top: {
		type: [Number, String],
		default: 12
	},
	zIndex: {
		type: Number,
		default: 50
	}
});

const notices = ref([]);
const currentIndex = ref(0);
const animationSeed = ref(0);
let rotateTimer = null;

const barStyle = computed(() => ({
	top: typeof props.top === 'number' ? `${props.top}px` : props.top,
	zIndex: String(props.zIndex)
}));

const visibleNotice = computed(() => {
	if (!notices.value.length) return null;
	return notices.value[currentIndex.value] || notices.value[0];
});

const stopRotation = () => {
	if (rotateTimer) {
		clearInterval(rotateTimer);
		rotateTimer = null;
	}
};

const startRotation = () => {
	stopRotation();
	if (!notices.value.length) return;

	rotateTimer = setInterval(() => {
		animationSeed.value += 1;
		if (notices.value.length > 1) {
			currentIndex.value = (currentIndex.value + 1) % notices.value.length;
		}
	}, 8000);
};

const refreshNotices = async () => {
	const payload = await loadGlobalNotices();
	if (!payload.globalEnable) {
		notices.value = [];
		stopRotation();
		return;
	}

	notices.value = payload.items || [];
	if (currentIndex.value >= notices.value.length) {
		currentIndex.value = 0;
	}
	animationSeed.value += 1;
	startRotation();
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

onMounted(() => {
	refreshNotices();
});

onBeforeUnmount(() => {
	stopRotation();
});
</script>

<style scoped>
.notice-bar {
	position: fixed;
	left: 12px;
	right: 12px;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 10px;
	border-radius: 12px;
	background: rgba(255, 255, 255, 0.94);
	box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
	border: 1px solid rgba(15, 23, 42, 0.06);
	overflow: hidden;
}

.notice-main {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 8px;
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
}

.notice-track {
	display: inline-block;
	padding-left: 100%;
	white-space: nowrap;
	animation: notice-scroll 7.2s linear 1;
}

.notice-text {
	font-size: 13px;
	color: #0f172a;
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

@keyframes notice-scroll {
	0% {
		transform: translateX(0);
	}

	100% {
		transform: translateX(-100%);
	}
}
</style>
