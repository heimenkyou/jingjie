<template>
	<view class="notice-root" v-if="visibleNotice">
		<view class="notice-bar" :style="barStyle">
			<swiper
				class="notice-swiper-inline"
				:current="currentIndex"
				:autoplay="notices.length > 1"
				:interval="5000"
				:duration="300"
				:circular="notices.length > 1"
				@change="handleInlineSwiperChange"
			>
				<swiper-item v-for="(item, index) in notices" :key="item.id">
					<view class="notice-main" @click="openDialog(index)">
						<text class="notice-tag" :class="`notice-tag-${item.level || 'info'}`">公告</text>
						<text class="notice-text">{{ item.content }}</text>
						<text class="notice-hint">点击查看</text>
						<text
							v-if="item.allowDismiss"
							class="notice-close"
							@click.stop="handleDismiss(item.id)"
						>
							×
						</text>
					</view>
				</swiper-item>
			</swiper>
		</view>

		<view v-if="dialogVisible" class="notice-mask" @click="closeDialog">
			<view class="notice-dialog" @click.stop>
				<view class="notice-dialog-header">
					<text class="notice-dialog-title">公告详情</text>
					<text class="notice-dialog-close" @click="closeDialog">×</text>
				</view>

				<swiper
					class="notice-swiper"
					:current="dialogIndex"
					:indicator-dots="notices.length > 1"
					:autoplay="false"
					:duration="250"
					indicator-color="rgba(15,23,42,0.16)"
					indicator-active-color="#10b981"
					@change="handleDialogSwiperChange"
				>
					<swiper-item v-for="item in notices" :key="item.id">
						<view class="notice-slide">
							<view class="notice-slide-header">
								<text class="notice-slide-tag" :class="`notice-slide-tag-${item.level || 'info'}`">
									{{ item.level === 'warn' ? '提醒' : item.level === 'error' ? '重要' : '公告' }}
								</text>
								<text class="notice-slide-count">{{ getNoticeIndex(item.id) }}/{{ notices.length }}</text>
							</view>
							<text class="notice-slide-content">{{ item.content }}</text>
							<view class="notice-slide-actions">
								<button
									v-if="item.link"
									class="notice-action notice-action-primary"
									@click="openNoticeLink(item.link)"
								>
									前往查看
								</button>
								<button
									v-if="item.allowDismiss"
									class="notice-action notice-action-secondary"
									@click="handleDialogDismiss(item.id)"
								>
									不再显示
								</button>
							</view>
						</view>
					</swiper-item>
				</swiper>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onHide, onShow } from '@dcloudio/uni-app';
import { dismissGlobalNotice, loadGlobalNotices } from '@/utils/notices.js';

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
const emit = defineEmits(['dialog-change']);

const notices = ref([]);
const currentIndex = ref(0);
const dialogVisible = ref(false);
const dialogIndex = ref(0);

const barStyle = computed(() => ({
	bottom: typeof props.bottom === 'number' ? `${props.bottom}px` : props.bottom,
	zIndex: String(props.zIndex)
}));

const visibleNotice = computed(() => {
	if (!notices.value.length) return null;
	return notices.value[currentIndex.value] || notices.value[0];
});

/**
 * 刷新公告列表，并同步当前全局公告索引。
 */
const refreshNotices = async ({ force = false } = {}) => {
	const payload = await loadGlobalNotices({ force });
	if (!payload.globalEnable) {
		notices.value = [];
		setDialogVisible(false);
		currentIndex.value = 0;
		return;
	}

	notices.value = payload.items || [];
	if (currentIndex.value >= notices.value.length) {
		currentIndex.value = 0;
	}
	if (dialogVisible.value && dialogIndex.value >= notices.value.length) {
		dialogIndex.value = Math.max(0, notices.value.length - 1);
	}
};

/**
 * 打开公告详情弹窗。
 */
const openDialog = async (index = currentIndex.value) => {
	if (!visibleNotice.value) return;
	const targetNoticeId = notices.value[index]?.id || visibleNotice.value.id;
	await refreshNotices({ force: true });
	const nextIndex = notices.value.findIndex(item => item.id === targetNoticeId);
	dialogIndex.value = nextIndex === -1 ? Math.min(index, Math.max(0, notices.value.length - 1)) : nextIndex;
	if (!notices.value.length) return;
	setDialogVisible(true);
};

/**
 * 关闭公告详情弹窗。
 */
const closeDialog = () => {
	setDialogVisible(false);
};

/**
 * 根据公告 id 计算当前是第几条，便于在弹窗里展示页码。
 * @param {string} noticeId 公告 id
 * @returns {number}
 */
const getNoticeIndex = (noticeId) => {
	const index = notices.value.findIndex(item => item.id === noticeId);
	return index === -1 ? 1 : index + 1;
};

/**
 * 打开公告附带的链接。
 * @param {string} link 跳转链接
 */
const openNoticeLink = (link) => {
	if (!link) return;

	if (link === 'jingjie://page/settings') {
		closeDialog();
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

/**
 * 关闭当前展示的公告。
 */
const handleDismiss = async (noticeId) => {
	if (!noticeId) return;
	dismissGlobalNotice(noticeId);
	await refreshNotices();
};

/**
 * 在详情弹窗内关闭指定公告。
 * @param {string} noticeId 公告 id
 */
const handleDialogDismiss = async (noticeId) => {
	dismissGlobalNotice(noticeId);
	await refreshNotices();
	if (!notices.value.length) {
		setDialogVisible(false);
		return;
	}

	dialogIndex.value = Math.min(dialogIndex.value, notices.value.length - 1);
};

/**
 * 统一更新公告详情弹层状态，并把状态同步给宿主页。
 * @param {boolean} visible 是否显示弹层
 */
const setDialogVisible = (visible) => {
	dialogVisible.value = visible;
	emit('dialog-change', visible);
};

/**
 * 同步弹窗内 swiper 当前页。
 * @param {{ detail: { current: number } }} event swiper 切换事件
 */
const handleDialogSwiperChange = (event) => {
	dialogIndex.value = event.detail.current || 0;
};

/**
 * 同步底部单行公告当前展示索引。
 * @param {{ detail: { current: number } }} event swiper 切换事件
 */
const handleInlineSwiperChange = (event) => {
	currentIndex.value = event.detail.current || 0;
};

onShow(() => {
	refreshNotices();
});

onHide(() => {
	closeDialog();
});
</script>

<style scoped>
.notice-root {
	position: relative;
}

.notice-bar {
	position: fixed;
	left: 10px;
	right: 10px;
	height: 30px;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 0 10px;
	border-radius: 10px 10px 0 0;
	background: rgba(255, 255, 255, 0.98);
	box-shadow: 0 -6px 20px rgba(15, 23, 42, 0.12);
	border: 1px solid rgba(15, 23, 42, 0.06);
	border-bottom: none;
}

.notice-main {
	height: 100%;
	display: flex;
	align-items: center;
	gap: 8px;
	padding-right: 2px;
	box-sizing: border-box;
}

.notice-swiper-inline {
	flex: 1;
	height: 100%;
	min-width: 0;
}

.notice-tag,
.notice-slide-tag {
	flex-shrink: 0;
	padding: 2px 8px;
	border-radius: 999px;
	font-size: 11px;
	font-weight: 700;
	color: #fff;
}

.notice-tag-info,
.notice-slide-tag-info {
	background: #10b981;
}

.notice-tag-warn,
.notice-slide-tag-warn {
	background: #f59e0b;
}

.notice-tag-error,
.notice-slide-tag-error {
	background: #ef4444;
}

.notice-text {
	flex: 1;
	min-width: 0;
	font-size: 13px;
	color: #0f172a;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.notice-hint {
	flex-shrink: 0;
	font-size: 11px;
	color: #64748b;
}

.notice-close {
	flex-shrink: 0;
	width: 20px;
	height: 20px;
	line-height: 20px;
	text-align: center;
	border-radius: 50%;
	background: rgba(15, 23, 42, 0.06);
	color: #64748b;
	font-size: 14px;
}

.notice-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 120;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 18px;
	background: rgba(15, 23, 42, 0.42);
}

.notice-dialog {
	width: 100%;
	max-width: 520px;
	border-radius: 16px;
	background: #fff;
	padding: 14px 14px 16px;
	box-sizing: border-box;
}

.notice-dialog-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12px;
}

.notice-dialog-title {
	font-size: 16px;
	font-weight: 700;
	color: #0f172a;
}

.notice-dialog-close {
	width: 28px;
	height: 28px;
	line-height: 28px;
	text-align: center;
	border-radius: 50%;
	background: rgba(15, 23, 42, 0.06);
	color: #64748b;
	font-size: 16px;
}

.notice-swiper {
	height: 220px;
}

.notice-slide {
	height: 100%;
	box-sizing: border-box;
	padding: 6px 2px 26px;
	display: flex;
	flex-direction: column;
}

.notice-slide-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12px;
}

.notice-slide-count {
	font-size: 12px;
	color: #94a3b8;
}

.notice-slide-content {
	flex: 1;
	font-size: 14px;
	line-height: 1.7;
	color: #0f172a;
}

.notice-slide-actions {
	display: flex;
	gap: 10px;
	margin-top: 12px;
}

.notice-action {
	flex: 1;
	height: 38px;
	line-height: 38px;
	border-radius: 10px;
	font-size: 13px;
	padding: 0;
}

.notice-action::after {
	border: none;
}

.notice-action-primary {
	background: #10b981;
	color: #fff;
}

.notice-action-secondary {
	background: rgba(15, 23, 42, 0.06);
	color: #475569;
}
</style>
