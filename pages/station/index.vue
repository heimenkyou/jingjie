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

		<!-- #ifdef APP-PLUS -->
		<GlobalNoticeBar :z-index="35" @dialog-change="handleNoticeDialogChange" />
		<!-- #endif -->

		<view
			class="brightness-toggle"
			:class="{ active: isBrightnessBoosted }"
			@click="handleBrightnessToggle"
		>
			<text class="brightness-toggle-icon">{{ isBrightnessBoosted ? '☀' : '◐' }}</text>
			<text class="brightness-toggle-text">{{ isBrightnessBoosted ? '恢复亮度' : '点亮屏幕' }}</text>
		</view>

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

		<!-- #ifndef APP-PLUS -->
		<view class="brightness-tip" v-if="showBrightnessTip">
			<text class="tip-text">{{ brightnessTipText }}</text>
		</view>
		<!-- #endif -->
	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onBackPress, onHide, onLoad, onReady, onShow, onUnload } from '@dcloudio/uni-app';
// #ifdef APP-PLUS
import GlobalNoticeBar from '@/components/GlobalNoticeBar.vue';
// #endif
import {
	BRIGHTNESS_SCENES,
	boostSceneBrightness,
	isSceneAutoBrightnessEnabled,
	isSceneBrightnessBoosted,
	markManualBrightnessHintShown,
	restoreSceneBrightness,
	shouldShowManualBrightnessHint,
	toggleSceneBrightness
} from '@/utils/brightness.js';
import { STATION_LOG_PREFIX } from '@/utils/stationLog.js';
import { flushWebviewCookies } from '@/utils/webviewCookies.js';

const HEADER_HEIGHT = 44;
const NOTICE_BAR_HEIGHT = 32;
const BRIGHTNESS_CONTROL_HEIGHT = 48;
const DEFAULT_STATION_PAGE_KEY = 'home';
const systemInfo = uni.getSystemInfoSync();
const statusBarHeight = systemInfo.statusBarHeight || 0;
const headerTotalHeight = statusBarHeight + HEADER_HEIGHT;
const STATION_CACHE_GUARD_EVAL = `(function(){var suffix='-cache--/wow/z/uniapp/1100333/last-mile-fe/m-end-school-tab/home';var count=0;try{for(var index=window.localStorage.length-1;index>=0;index-=1){var key=window.localStorage.key(index);if(typeof key==='string'&&key.indexOf(suffix)!==-1){window.localStorage.removeItem(key);count+=1}}if(count){console.log('${STATION_LOG_PREFIX}','已清理驿站首页快照缓存:',count)}}catch(error){console.warn('${STATION_LOG_PREFIX}','清理驿站首页快照缓存失败:',error)}})();`;
const SAME_TAB_WINDOW_OPEN_BRIDGE_PATH = '_www/static/station-window-open-same-tab.js';
const SAME_TAB_WINDOW_OPEN_BRIDGE_EVAL = `(function(){if(window.__jingjieSameTabWindowOpenInstalled)return;window.__jingjieSameTabWindowOpenInstalled=true;var originalOpen=typeof window.open==='function'?window.open.bind(window):null;function normalizeUrl(url){if(!url)return '';try{return new URL(url,window.location.href).toString()}catch(error){return String(url)}}function navigateInSameTab(url){var targetUrl=normalizeUrl(url);if(!targetUrl)return null;window.location.assign(targetUrl);return null}window.open=function(url,target,features){if(target==='_blank'||target===''||target==null){return navigateInSameTab(url)}if(target==='_self'){return navigateInSameTab(url)}return originalOpen?originalOpen(url,target,features):navigateInSameTab(url)}})();`;
const STATION_RESOURCE_REDIRECTS = [
	{ match: '.*log\\.mmstat\\.com.*', redirect: '_www/static/empty.js' },
	{ match: '.*wgo\\.mmstat\\.com.*', redirect: '_www/static/empty.js' },
	{ match: '.*gm\\.mmstat\\.com.*', redirect: '_www/static/empty.js' }
];

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

/**
 * 根据 tab 标识获取对应的驿站页面配置。
 * @param {string} key 驿站页面标识
 * @returns {{ key: string, label: string, url: string }}
 */
const getPageByKey = (key) => {
	return stationPages.find(item => item.key === key) || stationPages[0];
};

/**
 * 读取本地保存的驿站默认页，并兜底到合法值。
 * @returns {string}
 */
const getStoredDefaultKey = () => {
	const key = uni.getStorageSync('stationDefaultPage') || DEFAULT_STATION_PAGE_KEY;
	return stationPages.some(item => item.key === key) ? key : DEFAULT_STATION_PAGE_KEY;
};

const currentKey = ref(getStoredDefaultKey());
const isLoading = ref(true);
const showBrightnessTip = ref(false);
const brightnessTipText = ref('✨ 已自动调亮屏幕');
const isBrightnessBoosted = ref(false);
const lastAppliedDefaultKey = ref('');
const fallbackSrc = ref(getPageByKey(currentKey.value).url);

let brightnessTipTimer = null;
let identityPreloadTimer = null;
let noticeDialogVisible = false;

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

const fallbackWebviewStyles = computed(() => ({
	top: `${headerTotalHeight}px`,
	bottom: '0px',
	progress: {
		color: '#10b981'
	}
}));

/**
 * 将驿站页亮度提升到最高。
 * @returns {Promise<boolean>}
 */
const setBrightnessMax = () => {
	return boostSceneBrightness(BRIGHTNESS_SCENES.station);
};

/**
 * 将驿站页亮度恢复到进入前的原始值。
 * @returns {Promise<boolean>}
 */
const restoreBrightness = () => {
	return restoreSceneBrightness(BRIGHTNESS_SCENES.station);
};

/**
 * 展示驿站页亮度提示，App 端优先使用原生 toast。
 * @param {string} message 提示文案
 */
const showBrightnessNotice = (message) => {
	// #ifdef APP-PLUS
	if (typeof plus !== 'undefined' && plus.nativeUI?.toast) {
		plus.nativeUI.toast(message, {
			verticalAlign: 'bottom'
		});
		return;
	}
	// #endif

	brightnessTipText.value = message;
	showBrightnessTip.value = true;
	if (brightnessTipTimer) clearTimeout(brightnessTipTimer);
	brightnessTipTimer = setTimeout(() => {
		showBrightnessTip.value = false;
	}, 3000);
};

/**
 * 同步当前驿站页是否处于高亮状态。
 */
const syncBrightnessBoostedState = () => {
	isBrightnessBoosted.value = isSceneBrightnessBoosted(BRIGHTNESS_SCENES.station);
};

/**
 * 首次手动点亮前给用户一个提醒，避免突然刺眼。
 * @returns {Promise<boolean>}
 */
const confirmManualBrightnessToggle = () =>
	new Promise((resolve) => {
		if (!shouldShowManualBrightnessHint()) {
			resolve(true);
			return;
		}

		uni.showModal({
			title: '点亮屏幕',
			content: '点击后会临时拉满屏幕亮度，方便查看取件码。您也可以在设置里开启“驿站页自动点亮”。',
			confirmText: '继续',
			success: (res) => {
				if (res.confirm) {
					markManualBrightnessHintShown();
					resolve(true);
					return;
				}

				resolve(false);
			},
			fail: () => resolve(false)
		});
	});

/**
 * 处理驿站页右下角亮度按钮点击。
 */
const handleBrightnessToggle = async () => {
	if (!isBrightnessBoosted.value) {
		const confirmed = await confirmManualBrightnessToggle();
		if (!confirmed) return;
	}

	const boosted = await toggleSceneBrightness(BRIGHTNESS_SCENES.station);
	syncBrightnessBoostedState();
	showBrightnessNotice(
		boosted
			? '✨ 已手动拉满亮度，可在设置中开启驿站页自动点亮'
			: '已恢复原亮度'
	);
};

/**
 * 清理驿站页亮度提示和对应计时器。
 */
const clearBrightnessNotice = () => {
	if (brightnessTipTimer) {
		clearTimeout(brightnessTipTimer);
		brightnessTipTimer = null;
	}
	showBrightnessTip.value = false;
};

/**
 * 清理身份码后台预加载计时器，避免重复排队。
 */
const clearIdentityPreloadTimer = () => {
	if (!identityPreloadTimer) return;
	clearTimeout(identityPreloadTimer);
	identityPreloadTimer = null;
};

// #ifdef APP-PLUS
/**
 * 获取当前 uni 页面对应的原生宿主 WebView。
 * @returns {PlusWebviewWebviewObject | null}
 */
const getCurrentAppWebview = () => {
	const pages = getCurrentPages();
	const currentUniPage = pages[pages.length - 1];
	return currentUniPage && typeof currentUniPage.$getAppWebview === 'function'
		? currentUniPage.$getAppWebview()
		: null;
};

/**
 * 生成驿站子 WebView 的固定 id，便于复用和排查。
 * @param {string} key 驿站页面标识
 * @returns {string}
 */
const getChildWebviewId = (key) => {
	return `station-child-${key}`;
};

/**
 * 计算驿站子 WebView 的原生布局，给顶部工具栏和底部控件留出空间。
 * @returns {Record<string, unknown>}
 */
const getChildWebviewStyle = () => {
	return {
		top: `${headerTotalHeight}px`,
		bottom: `${NOTICE_BAR_HEIGHT + BRIGHTNESS_CONTROL_HEIGHT}px`,
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

/**
 * 给整个驿站页挂上资源秒回拦截，尽量压掉无意义埋点请求和刷屏报错。
 * @param {PlusWebviewWebviewObject} webview 子 WebView
 */
const applyStationResourceRedirects = (webview) => {
	if (!webview || typeof webview.overrideResourceRequest !== 'function') {
		return;
	}

	webview.overrideResourceRequest(STATION_RESOURCE_REDIRECTS);
};

/**
 * 在同一个驿站宿主里后台预加载身份码页，避免首次点开时从零加载。
 * 只预热身份码，不改当前 tab，也不影响当前页面的加载状态。
 */
const queueIdentityPreload = () => {
	clearIdentityPreloadTimer();
	if (!parentWebview || currentKey.value === 'identity' || childWebviews.has('identity')) {
		return;
	}

	identityPreloadTimer = setTimeout(() => {
		identityPreloadTimer = null;
		if (!parentWebview || currentKey.value === 'identity' || childWebviews.has('identity')) {
			return;
		}

		ensureChildWebview('identity');
		syncChildVisibility();
		console.log(STATION_LOG_PREFIX, '已在驿站页后台预加载身份码');
	}, 120);
};

/**
 * 给子 WebView 注入驿站专用脚本。
 * 先按需清理首页旧壳缓存，再补同页跳转桥接。
 * @param {PlusWebviewWebviewObject | null | undefined} webview 子 WebView
 */
const bindSameTabWindowOpenBridge = (webview) => {
	if (!webview) return;

	if (typeof webview.appendJsFile === 'function') {
		webview.appendJsFile(SAME_TAB_WINDOW_OPEN_BRIDGE_PATH);
	}

	if (typeof webview.evalJS === 'function') {
		webview.evalJS(STATION_CACHE_GUARD_EVAL);
		webview.evalJS(SAME_TAB_WINDOW_OPEN_BRIDGE_EVAL);
	}
};

/**
 * 页面恢复显示后，给所有存活中的子 WebView 重新补注入脚本。
 */
const rebindAllSameTabWindowOpenBridges = () => {
	childWebviews.forEach((child) => {
		bindSameTabWindowOpenBridge(child);
	});
};

/**
 * 公告详情弹层显示时先隐藏当前原生子 WebView，关闭后再恢复。
 * 这样仍可复用现有 Vue 公告样式，不需要改成原生弹窗。
 * @param {boolean} visible 公告详情弹层是否可见
 */
const handleNoticeDialogChange = (visible) => {
	noticeDialogVisible = visible;
	if (!childWebviews.size) return;

	if (visible) {
		childWebviews.forEach((child) => {
			child.hide('none');
		});
		return;
	}

	syncChildVisibility();
};

/**
 * 仅在当前 tab 上同步加载态，避免隐藏页事件误改头部状态。
 * @param {string} key 驿站页面标识
 */
const setCurrentLoadingByKey = (key) => {
	if (currentKey.value !== key) return;
	isLoading.value = !pageLoadedSet.has(key);
};

/**
 * 刷新当前 tab 的返回能力缓存，保证系统返回键行为正确。
 * @param {string} key 驿站页面标识
 */
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

/**
 * 绑定子 WebView 的加载事件。
 * 这里顺手补脚本注入和 Cookie 落盘，尽量让前后台状态更稳定。
 * @param {string} key 驿站页面标识
 * @param {PlusWebviewWebviewObject} webview 子 WebView
 */
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

/**
 * 创建指定 tab 的原生子 WebView。
 * @param {string} key 驿站页面标识
 * @returns {PlusWebviewWebviewObject | null}
 */
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
			console.warn(STATION_LOG_PREFIX, '关闭旧驿站子窗口失败:', error);
		}
	}

	const child = plus.webview.create('', webviewId, getChildWebviewStyle());
	childWebviews.set(key, child);
	pageCanBackMap.set(key, false);
	applyStationResourceRedirects(child);
	bindSameTabWindowOpenBridge(child);
	bindChildWebviewEvents(key, child);
	parentWebview.append(child);
	if (key !== currentKey.value) {
		child.hide('none');
	}
	child.loadURL(page.url);
	return child;
};

/**
 * 确保目标 tab 的子 WebView 已存在。
 * @param {string} key 驿站页面标识
 * @returns {PlusWebviewWebviewObject | null}
 */
const ensureChildWebview = (key) => {
	return childWebviews.get(key) || createChildWebview(key);
};

/**
 * 切换三个驿站子页面的显隐，只保留当前 tab 可见。
 */
const syncChildVisibility = () => {
	if (noticeDialogVisible) {
		childWebviews.forEach((child) => {
			child.hide('none');
		});
		return;
	}

	childWebviews.forEach((child, key) => {
		if (key === currentKey.value) {
			child.show('none');
			refreshCanBackState(key);
		} else {
			child.hide('none');
		}
	});
};

/**
 * 首次进入驿站页时初始化当前 tab 对应的原生子 WebView。
 */
const initAppWebviews = () => {
	parentWebview = getCurrentAppWebview();
	if (!parentWebview) return;

	ensureChildWebview(currentKey.value);
	syncChildVisibility();
	setCurrentLoadingByKey(currentKey.value);
	queueIdentityPreload();
};

/**
 * 刷新当前原生子 WebView。
 * @returns {boolean}
 */
const reloadNativeWebview = () => {
	const active = childWebviews.get(currentKey.value);
	if (!active) return false;
	pageLoadedSet.delete(currentKey.value);
	pageCanBackMap.set(currentKey.value, false);
	isLoading.value = true;
	active.reload(true);
	return true;
};

/**
 * 关闭并释放所有驿站子 WebView。
 */
const closeAllChildren = () => {
	childWebviews.forEach((child) => {
		try {
			child.close('none');
		} catch (error) {
			console.warn(STATION_LOG_PREFIX, '关闭驿站子窗口失败:', error);
		}
	});
	childWebviews.clear();
	pageLoadedSet.clear();
	pageCanBackMap.clear();
	parentWebview = null;
};
// #endif

/**
 * 切换当前驿站 tab。
 * @param {string} key 驿站页面标识
 */
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

/**
 * 刷新当前驿站页内容。
 * App 端优先刷新原生子 WebView，H5 端回退到重设 src。
 */
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

/**
 * H5 端 WebView 加载完成后的收尾处理。
 */
const handleFallbackLoad = () => {
	isLoading.value = false;
	flushWebviewCookies();
	uni.stopPullDownRefresh();
};

/**
 * H5 端 WebView 加载失败时给出统一提示。
 */
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
	queueIdentityPreload();
	// #endif

	// 驿站页重新显示时，根据设置决定是否自动点亮。
	syncBrightnessBoostedState();
	if (isSceneAutoBrightnessEnabled(BRIGHTNESS_SCENES.station)) {
		setBrightnessMax().then(() => {
			syncBrightnessBoostedState();
			showBrightnessNotice('✨ 已自动调亮屏幕');
		});
	}
});

onHide(() => {
	flushWebviewCookies();
	clearBrightnessNotice();
	clearIdentityPreloadTimer();
	noticeDialogVisible = false;

	// 切离驿站页后恢复进入前的原始亮度。
	restoreBrightness().finally(() => {
		syncBrightnessBoostedState();
	});
});

onUnload(() => {
	clearBrightnessNotice();
	clearIdentityPreloadTimer();
	noticeDialogVisible = false;
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

.brightness-toggle {
	position: fixed;
	right: 12px;
	bottom: 38px;
	z-index: 36;
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 9px 12px;
	border-radius: 999px;
	background: rgba(15, 23, 42, 0.72);
	border: 1px solid rgba(255, 255, 255, 0.14);
	backdrop-filter: blur(10px);
}

.brightness-toggle.active {
	background: rgba(16, 185, 129, 0.92);
}

.brightness-toggle-icon {
	font-size: 14px;
	line-height: 1;
	color: #fff;
}

.brightness-toggle-text {
	font-size: 12px;
	line-height: 1;
	color: #fff;
}

.brightness-tip {
	position: absolute;
	bottom: 56px;
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
