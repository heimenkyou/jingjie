<template>
	<view class="station-page">
		<view class="station-header" :style="headerStyle">
			<view class="toolbar">
				<view class="segment">
					<view
						v-for="item in stationPages"
						:key="item.key"
						class="segment-item"
						:class="{ active: currentKey === item.key, loading: isLoading && currentKey === item.key }"
						@click="switchPage(item.key)"
					>
						<text class="segment-text">{{ item.label }}</text>
					</view>
				</view>
				<button class="refresh-button" @click="reloadWebview">刷新</button>
			</view>
			<view class="loading-line" v-if="isLoading">
				<view class="loading-dot"></view>
				<text class="loading-text">正在打开{{ currentLabel }}...</text>
			</view>
		</view>

		<view class="web-shell" :style="webShellStyle">
			<web-view
				id="stationWebview"
				class="station-webview"
				:src="webviewSrc"
				:webview-styles="webviewStyles"
				@load="handleWebviewLoad"
				@error="handleWebviewError"
			></web-view>
		</view>

		<view class="brightness-tip" v-if="showBrightnessTip">
			<text class="tip-text">✨ 已为您自动调整至最高亮度</text>
		</view>
	</view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, ref } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';

const HEADER_HEIGHT = 44;
const systemInfo = uni.getSystemInfoSync();
const statusBarHeight = systemInfo.statusBarHeight || 0;
const headerTotalHeight = statusBarHeight + HEADER_HEIGHT;

const stationPages = [
	{
		key: 'identity',
		label: '淘宝身份码',
		url: 'https://pages-fast.m.taobao.com/wow/z/uniapp/1100410/last-mile-fe/m-end-identity-code/home'
	},
	{
		key: 'home',
		label: '驿站首页',
		url: 'https://pages-fast.m.taobao.com/wow/z/uniapp/1100333/last-mile-fe/m-end-school-tab/home'
	},
	{
		key: 'cainiao',
		label: '菜鸟出库',
		url: 'https://market.m.taobao.com/app/cn-yz/multi-activity/authCode.html?bizEntry=ALIPAY_GUOGUO'
	}
];

const currentKey = ref('identity');
const webviewSrc = ref(stationPages[0].url);
const isLoading = ref(true);
const showBrightnessTip = ref(false);
const instance = getCurrentInstance();
const lastAppliedDefaultKey = ref('');
let brightnessTipTimer = null;

const currentPage = computed(() => {
	return stationPages.find(item => item.key === currentKey.value) || stationPages[0];
});

const currentLabel = computed(() => {
	return currentPage.value.label;
});

const headerStyle = computed(() => ({
	height: `${headerTotalHeight}px`,
	paddingTop: `${statusBarHeight}px`
}));

const webShellStyle = computed(() => ({
	top: `${headerTotalHeight}px`
}));

const webviewStyles = {
	top: `${headerTotalHeight}px`,
	bottom: '0px',
	progress: {
		color: '#10b981'
	}
};

const switchPage = (key) => {
	if (currentKey.value === key) return;
	currentKey.value = key;
	isLoading.value = true;
	webviewSrc.value = currentPage.value.url;
};

const reloadWebview = () => {
	isLoading.value = true;

	// #ifdef APP-PLUS
	if (typeof uni.createWebviewContext === 'function') {
		const webviewContext = uni.createWebviewContext('stationWebview', instance?.proxy);
		if (webviewContext && typeof webviewContext.reload === 'function') {
			webviewContext.reload();
			return;
		}
	}
	// #endif

	const url = webviewSrc.value;
	webviewSrc.value = '';
	nextTick(() => {
		webviewSrc.value = url;
	});
};

const handleWebviewLoad = () => {
	isLoading.value = false;
	uni.stopPullDownRefresh();
};

const handleWebviewError = () => {
	isLoading.value = false;
	uni.stopPullDownRefresh();
	uni.showToast({
		title: '页面加载失败，点击刷新重试',
		icon: 'none'
	});
};

onShow(() => {
	const defaultKey = uni.getStorageSync('stationDefaultPage') || 'identity';
	if (defaultKey !== lastAppliedDefaultKey.value && stationPages.some(item => item.key === defaultKey)) {
		currentKey.value = defaultKey;
		webviewSrc.value = currentPage.value.url;
		isLoading.value = true;
		lastAppliedDefaultKey.value = defaultKey;
	}

	// #ifdef APP-PLUS
	uni.setScreenBrightness({
		value: 1
	});
	// #endif

	showBrightnessTip.value = true;
	if (brightnessTipTimer) clearTimeout(brightnessTipTimer);
	brightnessTipTimer = setTimeout(() => {
		showBrightnessTip.value = false;
	}, 3000);
});

onHide(() => {
	if (brightnessTipTimer) {
		clearTimeout(brightnessTipTimer);
		brightnessTipTimer = null;
	}
	showBrightnessTip.value = false;

	// #ifdef APP-PLUS
	uni.setScreenBrightness({
		value: 0.5
	});
	// #endif
});
</script>

<style scoped>
.station-page {
	min-height: 100vh;
	background: #f5f5f5;
}

.station-header {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 20;
	box-sizing: border-box;
	background: rgba(255, 255, 255, 0.96);
	border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.toolbar {
	display: flex;
	align-items: center;
	height: 44px;
	padding: 6px 8px;
	box-sizing: border-box;
	gap: 6px;
}

.segment {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 6px;
}

.segment-item {
	flex: 1;
	height: 32px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 8px;
	background: transparent;
	color: #555;
}

.segment-item.active {
	background: #10b981;
	color: #fff;
}

.segment-item.loading {
	opacity: 0.82;
}

.segment-text {
	font-size: 13px;
	font-weight: 600;
	line-height: 1;
}

.refresh-button {
	width: 46px;
	height: 32px;
	padding: 0;
	margin: 0;
	border-radius: 8px;
	border: 1px solid rgba(16, 185, 129, 0.28);
	background: rgba(16, 185, 129, 0.08);
	color: #10b981;
	font-size: 12px;
	line-height: 32px;
}

.refresh-button::after {
	border: none;
}

.loading-line {
	height: 18px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	margin-top: -3px;
	color: #10b981;
}

.loading-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #10b981;
	animation: pulse 0.8s ease-in-out infinite;
}

.loading-text {
	font-size: 11px;
	line-height: 1;
}

@keyframes pulse {
	0% {
		opacity: 0.35;
		transform: scale(0.8);
	}

	50% {
		opacity: 1;
		transform: scale(1);
	}

	100% {
		opacity: 0.35;
		transform: scale(0.8);
	}
}

.web-shell {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	background: #fff;
}

.station-webview {
	width: 100%;
	height: 100%;
}

.brightness-tip {
	position: absolute;
	bottom: 20px;
	left: 50%;
	z-index: 30;
	transform: translateX(-50%);
	background: rgba(16, 185, 129, 0.9);
	padding: 8px 18px;
	border-radius: 20px;
	animation: fadeInOut 3s ease-in-out;
}

.tip-text {
	font-size: 13px;
	color: #fff;
}

@keyframes fadeInOut {
	0% {
		opacity: 0;
		transform: translateX(-50%) translateY(10px);
	}

	15% {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}

	85% {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}

	100% {
		opacity: 0;
		transform: translateX(-50%) translateY(10px);
	}
}
</style>
