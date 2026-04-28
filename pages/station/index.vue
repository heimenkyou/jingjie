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

		<GlobalNoticeBar :top="headerTotalHeight + 8" :z-index="35" />

		<!-- #ifdef APP-PLUS -->
		<view class="native-webview-shell" :style="webShellStyle"></view>
		<!-- #endif -->

		<!-- #ifndef APP-PLUS -->
		<view class="web-shell" :style="webShellStyle">
			<web-view
				id="stationWebviewFallback"
				class="station-webview"
				:src="fallbackSrc"
				:webview-styles="fallbackWebviewStyles"
				@load="handleFallbackLoad"
				@error="handleFallbackError"
			></web-view>
		</view>
		<!-- #endif -->

		<view class="brightness-tip" v-if="showBrightnessTip">
			<text class="tip-text">✨ 已为您自动调整至最高亮度</text>
		</view>
	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onBackPress, onHide, onLoad, onReady, onShow, onUnload } from '@dcloudio/uni-app';
import GlobalNoticeBar from '@/components/GlobalNoticeBar.vue';
import { flushWebviewCookies } from '@/utils/webviewCookies.js';

const HEADER_HEIGHT = 44;
const systemInfo = uni.getSystemInfoSync();
const statusBarHeight = systemInfo.statusBarHeight || 0;
const headerTotalHeight = statusBarHeight + HEADER_HEIGHT;
const SAME_TAB_WINDOW_OPEN_BRIDGE_PATH = '_www/static/station-window-open-same-tab.js';
const SAME_TAB_WINDOW_OPEN_BRIDGE_EVAL = `(function(){if(window.__jingjieSameTabWindowOpenInstalled)return;window.__jingjieSameTabWindowOpenInstalled=true;var originalOpen=typeof window.open==='function'?window.open.bind(window):null;function normalizeUrl(url){if(!url)return '';try{return new URL(url,window.location.href).toString()}catch(error){return String(url)}}function navigateInSameTab(url){var targetUrl=normalizeUrl(url);if(!targetUrl)return null;window.location.assign(targetUrl);return null}window.open=function(url,target,features){if(target==='_blank'||target===''||target==null){return navigateInSameTab(url)}if(target==='_self'){return navigateInSameTab(url)}return originalOpen?originalOpen(url,target,features):navigateInSameTab(url)}})();`;

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

const getPageByKey = (key) => {
	return stationPages.find(item => item.key === key) || stationPages[0];
};

const getStoredDefaultKey = () => {
	const key = uni.getStorageSync('stationDefaultPage') || 'identity';
	return stationPages.some(item => item.key === key) ? key : 'identity';
};

const currentKey = ref(getStoredDefaultKey());
const isLoading = ref(true);
const showBrightnessTip = ref(false);
const lastAppliedDefaultKey = ref('');
const fallbackSrc = ref(getPageByKey(currentKey.value).url);

let brightnessTipTimer = null;

// #ifdef APP-PLUS
const childWebviews = new Map();
const pageLoadedSet = new Set();
const pageCanBackMap = new Map();
let parentWebview = null;
// #endif

const currentPage = computed(() => {
	return getPageByKey(currentKey.value);
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

const fallbackWebviewStyles = {
	top: `${headerTotalHeight}px`,
	bottom: '0px',
	progress: {
		color: '#10b981'
	}
};

const setBrightnessMax = () => {
	// #ifdef APP-PLUS
	uni.setScreenBrightness({
		value: 1
	});
	// #endif
};

const restoreBrightness = () => {
	// #ifdef APP-PLUS
	uni.setScreenBrightness({
		value: 0.5
	});
	// #endif
};

const showBrightnessNotice = () => {
	showBrightnessTip.value = true;
	if (brightnessTipTimer) clearTimeout(brightnessTipTimer);
	brightnessTipTimer = setTimeout(() => {
		showBrightnessTip.value = false;
	}, 3000);
};

const clearBrightnessNotice = () => {
	if (brightnessTipTimer) {
		clearTimeout(brightnessTipTimer);
		brightnessTipTimer = null;
	}
	showBrightnessTip.value = false;
};

// #ifdef APP-PLUS
const getCurrentAppWebview = () => {
	const pages = getCurrentPages();
	const currentUniPage = pages[pages.length - 1];
	return currentUniPage && typeof currentUniPage.$getAppWebview === 'function'
		? currentUniPage.$getAppWebview()
		: null;
};

const getChildWebviewId = (key) => {
	return `station-child-${key}`;
};

const getChildWebviewStyle = () => {
	return {
		top: `${headerTotalHeight}px`,
		bottom: '0px',
		left: '0px',
		right: '0px',
		progress: {
			color: '#10b981'
		},
		plusrequire: 'none',
		'uni-app': 'none',
		bounce: 'none'
	};
};

const bindSameTabWindowOpenBridge = (webview) => {
	if (!webview) return;

	if (typeof webview.appendJsFile === 'function') {
		webview.appendJsFile(SAME_TAB_WINDOW_OPEN_BRIDGE_PATH);
	}

	if (typeof webview.evalJS === 'function') {
		webview.evalJS(SAME_TAB_WINDOW_OPEN_BRIDGE_EVAL);
	}
};

const rebindAllSameTabWindowOpenBridges = () => {
	childWebviews.forEach((child) => {
		bindSameTabWindowOpenBridge(child);
	});
};

const setCurrentLoadingByKey = (key) => {
	if (currentKey.value !== key) return;
	isLoading.value = !pageLoadedSet.has(key);
};

const refreshCanBackState = (key) => {
	const child = childWebviews.get(key);
	if (!child || typeof child.canBack !== 'function') {
		pageCanBackMap.set(key, false);
		return;
	}

	child.canBack((event) => {
		pageCanBackMap.set(key, !!event.canBack);
	});
};

const bindChildWebviewEvents = (key, webview) => {
	webview.addEventListener('loading', () => {
		if (currentKey.value === key) {
			isLoading.value = true;
		}
	});

	webview.addEventListener('loaded', () => {
		pageLoadedSet.add(key);
		bindSameTabWindowOpenBridge(webview);
		setCurrentLoadingByKey(key);
		refreshCanBackState(key);
		flushWebviewCookies();
		uni.stopPullDownRefresh();
	});

	webview.addEventListener('error', () => {
		pageLoadedSet.delete(key);
		pageCanBackMap.set(key, false);
		setCurrentLoadingByKey(key);
		uni.stopPullDownRefresh();
		uni.showToast({
			title: '页面加载失败，点击刷新重试',
			icon: 'none'
		});
	});
};

const createChildWebview = (key) => {
	if (childWebviews.has(key)) return childWebviews.get(key);
	if (!parentWebview || typeof plus === 'undefined') return null;

	const page = getPageByKey(key);
	const webviewId = getChildWebviewId(key);
	const existing = plus.webview.getWebviewById(webviewId);
	if (existing) {
		try {
			existing.close('none');
		} catch (error) {
			console.warn('关闭旧驿站子窗口失败:', error);
		}
	}

	const child = plus.webview.create('', webviewId, getChildWebviewStyle());
	childWebviews.set(key, child);
	pageCanBackMap.set(key, false);
	bindSameTabWindowOpenBridge(child);
	bindChildWebviewEvents(key, child);
	parentWebview.append(child);
	child.loadURL(page.url);
	return child;
};

const ensureChildWebview = (key) => {
	return childWebviews.get(key) || createChildWebview(key);
};

const syncChildVisibility = () => {
	childWebviews.forEach((child, key) => {
		if (key === currentKey.value) {
			child.show('none');
			refreshCanBackState(key);
		} else {
			child.hide('none');
		}
	});
};

const initAppWebviews = () => {
	parentWebview = getCurrentAppWebview();
	if (!parentWebview) return;

	ensureChildWebview(currentKey.value);
	syncChildVisibility();
	setCurrentLoadingByKey(currentKey.value);
};

const reloadNativeWebview = () => {
	const active = childWebviews.get(currentKey.value);
	if (!active) return false;
	pageLoadedSet.delete(currentKey.value);
	pageCanBackMap.set(currentKey.value, false);
	isLoading.value = true;
	active.reload(true);
	return true;
};

const closeAllChildren = () => {
	childWebviews.forEach((child) => {
		try {
			child.close('none');
		} catch (error) {
			console.warn('关闭驿站子窗口失败:', error);
		}
	});
	childWebviews.clear();
	pageLoadedSet.clear();
	pageCanBackMap.clear();
	parentWebview = null;
};
// #endif

const switchPage = (key) => {
	if (currentKey.value === key) return;
	currentKey.value = key;

	// #ifdef APP-PLUS
	ensureChildWebview(key);
	syncChildVisibility();
	setCurrentLoadingByKey(key);
	return;
	// #endif

	// #ifndef APP-PLUS
	fallbackSrc.value = getPageByKey(key).url;
	isLoading.value = true;
	// #endif
};

const reloadWebview = () => {
	flushWebviewCookies();

	// #ifdef APP-PLUS
	if (reloadNativeWebview()) return;
	// #endif

	isLoading.value = true;
	const url = fallbackSrc.value;
	fallbackSrc.value = '';
	setTimeout(() => {
		fallbackSrc.value = url;
	}, 0);
};

const handleFallbackLoad = () => {
	isLoading.value = false;
	flushWebviewCookies();
	uni.stopPullDownRefresh();
};

const handleFallbackError = () => {
	isLoading.value = false;
	uni.stopPullDownRefresh();
	uni.showToast({
		title: '页面加载失败，点击刷新重试',
		icon: 'none'
	});
};

onLoad(() => {
	lastAppliedDefaultKey.value = currentKey.value;
});

onReady(() => {
	// #ifdef APP-PLUS
	initAppWebviews();
	// #endif
});

onShow(() => {
	const defaultKey = getStoredDefaultKey();
	if (defaultKey !== lastAppliedDefaultKey.value) {
		currentKey.value = defaultKey;
		lastAppliedDefaultKey.value = defaultKey;

		// #ifdef APP-PLUS
		ensureChildWebview(defaultKey);
		syncChildVisibility();
		setCurrentLoadingByKey(defaultKey);
		// #endif

		// #ifndef APP-PLUS
		fallbackSrc.value = getPageByKey(defaultKey).url;
		isLoading.value = true;
		// #endif
	}

	// #ifdef APP-PLUS
	rebindAllSameTabWindowOpenBridges();
	// #endif

	setBrightnessMax();
	showBrightnessNotice();
});

onHide(() => {
	flushWebviewCookies();
	clearBrightnessNotice();
	restoreBrightness();
});

onUnload(() => {
	clearBrightnessNotice();
	restoreBrightness();

	// #ifdef APP-PLUS
	closeAllChildren();
	// #endif
});

onBackPress((options) => {
	// #ifdef APP-PLUS
	if (options?.from !== 'backbutton' && options?.from !== 'navigateBack') {
		return false;
	}

	const active = childWebviews.get(currentKey.value);
	if (!active) return false;

	if (!pageCanBackMap.get(currentKey.value)) {
		return false;
	}

	active.back();
	setTimeout(() => {
		refreshCanBackState(currentKey.value);
	}, 150);
	return true;
	// #endif

	return false;
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

.web-shell,
.native-webview-shell {
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
