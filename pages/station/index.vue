<template>
	<view class="station-page">
		<!-- #ifdef APP-PLUS -->
		<GlobalNoticeBar />
		<!-- #endif -->

		<view class="station-content" :style="contentStyle">
			<view class="page-heading">
				<text class="page-title">驿站</text>
			</view>

			<view
				v-for="target in stationTargets"
				:key="target.key"
				class="station-action"
				@click="openTarget(target.key)"
			>
				<view class="station-action-icon">
					<image class="station-action-image" :src="target.icon" mode="aspectFit"></image>
				</view>
				<view class="station-action-copy">
					<text class="station-action-title">{{ target.title }}</text>
					<text class="station-action-desc">{{ target.description }}</text>
				</view>
				<view class="auto-open-control" @click.stop="toggleAutoOpen(target.key)">
					<text class="auto-open-label">自动跳转</text>
					<view class="auto-open-switch" :class="{ active: autoOpenTarget === target.key }">
						<view class="auto-open-knob"></view>
					</view>
				</view>
			</view>

			<view class="shortcut-card" @click="addStationShortcut">
				<view class="shortcut-copy">
					<text class="shortcut-title">经常取件？</text>
					<text class="shortcut-desc">把常用入口添加到桌面，一点即达</text>
				</view>
				<view class="shortcut-button">
					<text>添加</text>
				</view>
			</view>
		</view>

		<view class="opening-mask" v-if="openingTarget">
			<view class="opening-dialog">
				<view class="opening-dot"></view>
				<text class="opening-title">正在打开{{ openingTarget.title }}</text>
				<text class="opening-desc">即将跳转到淘宝</text>
				<view class="cancel-button" @click="cancelOpening">
					<text>取消</text>
				</view>
			</view>
		</view>
		<UpdateDownloadDialog />
	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app';
// #ifdef APP-PLUS
import GlobalNoticeBar from '@/components/GlobalNoticeBar.vue';
// #endif
import {
	getStationAutoOpenTarget,
	requestStationShortcut,
	setStationAutoOpenTarget,
	STATION_TARGETS
} from '@/utils/station.js';
import { ANALYTICS_EVENTS, track, trackPage } from '@/utils/analytics.js';
import UpdateDownloadDialog from '@/components/UpdateDownloadDialog.vue';

const AUTO_OPEN_DELAY = 450;
const systemInfo = uni.getSystemInfoSync();
const statusBarHeight = systemInfo.statusBarHeight || 0;
const stationTargets = [
	{
		...STATION_TARGETS.identity,
		title: '身份码',
		description: '点击卡片，跳转淘宝身份码',
		icon: '/static/barcode-icon-active.png'
	},
	{
		...STATION_TARGETS.home,
		title: '我的驿站',
		description: '点击卡片，跳转淘宝查看包裹',
		icon: '/static/station-icon-active.png'
	}
];

const autoOpenTarget = ref(getStationAutoOpenTarget());
const openingKey = ref('');
let openingTimer = null;
let hasAutoOpened = false;
let openingExternalApp = false;

const contentStyle = computed(() => ({
	paddingTop: `${statusBarHeight + 22}px`
}));

const openingTarget = computed(() => {
	return stationTargets.find(target => target.key === openingKey.value) || null;
});

/**
 * 清除尚未执行的跳转。
 */
const clearOpeningTimer = () => {
	if (!openingTimer) return;
	clearTimeout(openingTimer);
	openingTimer = null;
};

/**
 * 打开淘宝中的指定驿站页面。
 * @param {string} key 驿站目标标识
 */
const openTarget = (key) => {
	const target = STATION_TARGETS[key];
	if (!target || openingKey.value) return;

	openingKey.value = key;
	openingTimer = setTimeout(() => {
		openingTimer = null;
		openingKey.value = '';
		openingExternalApp = true;
		track(key === 'identity' ? ANALYTICS_EVENTS.stationOpenIdentityCode : ANALYTICS_EVENTS.stationOpenHome);

		// #ifdef APP-PLUS
		plus.runtime.openURL(target.url, () => {
			uni.showToast({ title: '未能打开淘宝，请确认已安装', icon: 'none' });
		});
		// #endif

		// #ifdef H5
		window.location.href = target.url;
		// #endif
	}, AUTO_OPEN_DELAY);
};

/**
 * 取消本次尚未执行的跳转。
 */
const cancelOpening = () => {
	clearOpeningTimer();
	openingKey.value = '';
};

/**
 * 切换自动打开目标，两个目标保持互斥。
 * @param {string} key 驿站目标标识
 */
const toggleAutoOpen = (key) => {
	autoOpenTarget.value = autoOpenTarget.value === key ? '' : key;
	setStationAutoOpenTarget(autoOpenTarget.value);
};

/**
 * 选择并请求创建桌面快捷方式。
 */
const addStationShortcut = () => {
	uni.showActionSheet({
		itemList: stationTargets.map(target => target.title),
		success: (event) => {
			const target = stationTargets[event.tapIndex];
			if (!target) return;

			const result = requestStationShortcut(target.key);
			if (result.success) {
				uni.showModal({
					title: result.updated ? '快捷方式已更新' : '快捷方式已创建',
					content: result.updated
						? '桌面图标和跳转目标已更新。'
						: '若桌面未出现，请在系统设置中允许净界创建桌面快捷方式后重试。',
					showCancel: false,
					confirmText: '知道了'
				});
				return;
			}

			const messages = {
				notApp: '仅支持在 Android 应用内添加',
				version: '系统版本不支持添加快捷方式',
				launcher: '当前桌面不支持添加快捷方式',
				failed: '创建快捷方式失败，请查看运行日志'
			};
			uni.showToast({ title: messages[result.reason] || messages.failed, icon: 'none' });
		}
	});
};

onLoad(() => {
	hasAutoOpened = false;
});

onShow(() => {
	trackPage('/pages/station/index');
	autoOpenTarget.value = getStationAutoOpenTarget();
	if (openingExternalApp) {
		openingExternalApp = false;
		return;
	}
	if (hasAutoOpened || !autoOpenTarget.value) return;

	hasAutoOpened = true;
	openTarget(autoOpenTarget.value);
});

onHide(() => {
	cancelOpening();
	if (!openingExternalApp) {
		hasAutoOpened = false;
	}
});

onUnload(() => {
	clearOpeningTimer();
});
</script>

<style scoped>
.station-page {
	min-height: 100vh;
	background-color: #F3F7FA;
	background-image: url('/static/settings-background.webp');
	background-position: center;
	background-size: auto 100vh;
	background-repeat: no-repeat;
	background-attachment: fixed;
}

.station-content {
	padding: 0 14px 84px;
}

.page-heading {
	margin: 8px 2px 20px;
}

.page-title {
	display: block;
	font-size: 26px;
	line-height: 1.2;
	font-weight: 700;
	color: #243447;
}

.station-action {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 16px 14px;
	margin-bottom: 12px;
	background: rgba(255, 255, 255, 0.82);
	border: 1px solid rgba(59, 145, 168, 0.16);
	border-radius: 16px;
	box-shadow: 0 3px 10px rgba(36, 52, 71, 0.06);
}

.station-action:active,
.shortcut-card:active,
.cancel-button:active {
	opacity: 0.8;
}

.station-action-icon {
	width: 42px;
	height: 42px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 14px;
	background: rgba(118, 198, 210, 0.16);
	flex-shrink: 0;
}

.station-action-image {
	width: 25px;
	height: 25px;
	display: block;
}

.station-action-copy,
.shortcut-copy {
	flex: 1;
	min-width: 0;
}

.station-action-title,
.shortcut-title {
	display: block;
	font-size: 16px;
	font-weight: 600;
	color: #243447;
}

.station-action-desc,
.shortcut-desc {
	display: block;
	margin-top: 5px;
	font-size: 12px;
	line-height: 1.4;
	color: #68798A;
}

.auto-open-control {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 5px;
	flex-shrink: 0;
}

.auto-open-label {
	font-size: 10px;
	line-height: 1;
	color: #68798A;
}

.auto-open-switch {
	width: 44px;
	height: 26px;
	padding: 3px;
	box-sizing: border-box;
	border-radius: 999px;
	background: #C8D6DE;
	transition: background 0.18s ease;
}

.auto-open-switch.active {
	background: #3B91A8;
}

.auto-open-knob {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: #ffffff;
	box-shadow: 0 1px 3px rgba(36, 52, 71, 0.2);
	transition: transform 0.18s ease;
}

.auto-open-switch.active .auto-open-knob {
	transform: translateX(18px);
}

.shortcut-card {
	position: fixed;
	left: 14px;
	right: 14px;
	bottom: 64px;
	z-index: 5;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 14px;
	background: rgba(255, 255, 255, 0.76);
	border: 1px solid rgba(59, 145, 168, 0.24);
	border-radius: 16px;
	box-shadow: 0 3px 10px rgba(36, 52, 71, 0.05);
}

.shortcut-button {
	padding: 7px 13px;
	border-radius: 999px;
	background: linear-gradient(135deg, #3B91A8 0%, #76C6D2 100%);
	color: #ffffff;
	font-size: 13px;
	font-weight: 500;
}

.opening-mask {
	position: fixed;
	inset: 0;
	z-index: 20;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 24px;
	background: rgba(36, 52, 71, 0.18);
}

.opening-dialog {
	width: 100%;
	max-width: 270px;
	padding: 24px 20px 18px;
	box-sizing: border-box;
	text-align: center;
	background: rgba(255, 255, 255, 0.96);
	border-radius: 18px;
	box-shadow: 0 10px 30px rgba(36, 52, 71, 0.18);
}

.opening-dot {
	width: 10px;
	height: 10px;
	margin: 0 auto 12px;
	border-radius: 50%;
	background: #3B91A8;
	animation: pulse 0.8s ease-in-out infinite;
}

.opening-title {
	display: block;
	font-size: 16px;
	font-weight: 600;
	color: #243447;
}

.opening-desc {
	display: block;
	margin-top: 7px;
	font-size: 12px;
	color: #68798A;
}

.cancel-button {
	margin-top: 18px;
	padding: 9px;
	border-radius: 12px;
	background: #E8F2F5;
	font-size: 13px;
	color: #3B91A8;
}

@keyframes pulse {
	0%, 100% { opacity: 0.35; transform: scale(0.8); }
	50% { opacity: 1; transform: scale(1); }
}
</style>
