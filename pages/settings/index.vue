<template>
	<view class="content">
		<!-- #ifdef APP-PLUS -->
		<GlobalNoticeBar />
		<!-- #endif -->

		<view class="header">
			<text class="subtitle">下方有使用说明</text>
		</view>

		<view class="settings-body">
			<view class="feature-section compact-section">
				<view class="section-heading section-heading-inline">
					<text class="section-title">基础偏好</text>
				</view>

				<view class="setting-row" @click="chooseStartupTab">
					<text class="setting-row-title">启动应用时</text>
					<view class="setting-row-value">
						<text class="setting-row-text">{{ currentStartupLabel }}</text>
						<text class="setting-row-arrow">></text>
					</view>
				</view>

				<view class="setting-row setting-row-child" @click="chooseDefaultBarcode">
					<text class="setting-row-title">条码页默认展示</text>
					<view class="setting-row-value">
						<text class="setting-row-text">{{ currentDefaultBarcodeLabel }}</text>
						<text class="setting-row-arrow">></text>
					</view>
				</view>

				<view class="setting-row setting-row-child" @click="chooseStationDefaultPage">
					<text class="setting-row-title">驿站页默认展示</text>
					<view class="setting-row-value">
						<text class="setting-row-text">{{ currentStationDefaultLabel }}</text>
						<text class="setting-row-arrow">></text>
					</view>
				</view>
			</view>

			<view class="feature-section compact-section">
				<view class="section-heading section-heading-inline">
					<text class="section-title">屏幕亮度</text>
				</view>

				<view class="toggle-row">
					<view class="toggle-copy">
						<text class="toggle-title">条码页自动点亮</text>
					</view>
					<switch :checked="viewerAutoBrightnessEnabled" color="#10b981" @change="handleViewerAutoBrightnessChange" />
				</view>

				<view class="toggle-row">
					<view class="toggle-copy">
						<text class="toggle-title">驿站页自动点亮</text>
					</view>
					<switch :checked="stationAutoBrightnessEnabled" color="#10b981" @change="handleStationAutoBrightnessChange" />
				</view>
			</view>

			<view class="feature-section compact-section">
				<view class="section-heading section-heading-inline">
					<text class="section-title">其他</text>
					<text class="section-desc">缓存、更新、说明</text>
				</view>

				<view class="setting-row" @click="handleClearStationCache">
					<text class="setting-row-title">清理驿站缓存</text>
					<view class="setting-row-value">
						<text class="setting-row-text subtle">{{ stationCacheSummary }}</text>
					</view>
				</view>

				<view class="setting-row" @click="handleCheckUpdate">
					<text class="setting-row-title">检查更新</text>
					<view class="setting-row-value">
						<text class="setting-row-text subtle">{{ currentVersionName }}</text>
					</view>
				</view>

				<view class="setting-row" @click="toggleOtherExpanded">
					<text class="setting-row-title">使用说明与关于项目</text>
					<view class="setting-row-value">
						<text class="setting-row-arrow">{{ otherExpanded ? '收起' : '>' }}</text>
					</view>
				</view>

				<view class="other-content" v-if="otherExpanded">
					<view class="info-section">
						<text class="info-text">1. 传截图：把饮水机/吹风机条码存进来，主页左右滑</text>
						<text class="info-text">2. 取快递：登录一次淘宝，以后点开直接出取件码。</text>
						<text class="info-text">3. 设默认：常用哪个，就把它设为“启动首选”。</text>
						<text class="info-text">4. 点亮屏：可在设置里开自动点亮，也可在页面右下角手动切换。</text>
					</view>

					<view class="about-section">
						<view class="about-block">
							<text class="about-text">受够了原版 App 的启动慢、广告多、藏得深。</text>
							<text class="about-text">虽然相册截图没有广告，但不能自动调亮屏幕，导致扫码经常失败。</text>
							<text class="about-text">所以有了它：零广告，点开就亮，一秒出码，拿完走人。把被烂软件偷走的时间，通通抢回来！</text>
						</view>

						<view class="divider"></view>

						<view class="author-section">
							<text class="author-title">👨‍💻 作者信息</text>
							<text class="author-collab">👤 罗文彬 + AI 协作</text>
							<text class="author-collab">（Vibe Coding 这一块🤠☝️）</text>
						</view>

						<view class="contact-section">
							<text class="contact-title">📧 联系方式（点击跳转）</text>
							<text class="contact-item contact-link" @click="openContactLink('qq')">QQ: 3209871721</text>
							<text class="contact-item contact-link" @click="copyWechat">微信: heimenkyou（备注来源）</text>
							<text class="contact-item contact-link" @click="openContactLink('email')">邮箱: wenbin.lo@outlook.com</text>
						</view>

						<view class="source-section">
							<text class="source-title">⭐ 开源地址</text>
							<text class="source-hint">本项目已开源，欢迎 Star 和贡献代码</text>
							<view class="source-links">
								<view class="source-link" @click="openSourceLink('github')">
									<image class="link-icon" src="/static/github.png" mode="aspectFit"></image>
									<text class="link-text">GitHub</text>
								</view>
								<view class="source-link" @click="openSourceLink('gitee')">
									<image class="link-icon" src="/static/gitee.png" mode="aspectFit"></image>
									<text class="link-text">Gitee</text>
								</view>
							</view>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
// #ifdef APP-PLUS
import GlobalNoticeBar from '@/components/GlobalNoticeBar.vue';
// #endif
import { APP_VERSION_NAME } from '@/utils/appVersion.js';
import { checkForUpdate } from '@/utils/updateChecker.js';
import { BRIGHTNESS_SCENES, getBrightnessPreferences, setSceneAutoBrightnessEnabled } from '@/utils/brightness.js';
import { clearWebviewSiteData } from '@/utils/webviewCookies.js';

const startupTab = ref('barcode');
const stationDefaultPage = ref('identity');
const viewerAutoBrightnessEnabled = ref(false);
const stationAutoBrightnessEnabled = ref(false);
const otherExpanded = ref(false);
const stationCacheSummary = ref('驿站页有毛病的话\n可以点击后重启应用');
const barcodes = ref([]);
const defaultBarcodeId = ref('');

const startupOptions = [
	{
		value: 'barcode',
		label: '本地条码'
	},
	{
		value: 'station',
		label: '快递驿站'
	}
];

const stationDefaultOptions = [
	{
		value: 'identity',
		label: '淘宝身份码'
	},
	{
		value: 'home',
		label: '驿站首页'
	},
	{
		value: 'cainiao',
		label: '菜鸟出库码'
	}
];

const contactLinks = {
	qq: 'https://qm.qq.com/q/Hr6wc28uCO',
	email: 'mailto:wenbin.lo@outlook.com'
};

const wechatId = 'heimenkyou';
const currentVersionName = APP_VERSION_NAME;

/**
 * 当前启动首选项对应的展示文字。
 */
const currentStartupLabel = computed(() => {
	return startupOptions.find(item => item.value === startupTab.value)?.label || '本地条码';
});

/**
 * 当前驿站默认展示页对应的展示文字。
 */
const currentStationDefaultLabel = computed(() => {
	return stationDefaultOptions.find(item => item.value === stationDefaultPage.value)?.label || '淘宝身份码';
});

/**
 * 当前默认条码对应的展示文字。
 */
const currentDefaultBarcodeLabel = computed(() => {
	if (!barcodes.value.length) return '未设置';
	const currentDefault = barcodes.value.find(item => item.id === defaultBarcodeId.value);
	if (currentDefault) {
		return currentDefault.name || '未命名';
	}
	return barcodes.value[0]?.name || '未命名';
});

/**
 * 读取启动项、驿站默认页和亮度偏好设置。
 */
const loadPreferences = () => {
	startupTab.value = uni.getStorageSync('startupTab') || 'barcode';
	stationDefaultPage.value = uni.getStorageSync('stationDefaultPage') || 'identity';
	barcodes.value = uni.getStorageSync('barcodes') || [];
	defaultBarcodeId.value = uni.getStorageSync('defaultBarcodeId') || '';

	if (barcodes.value.length > 0 && (!defaultBarcodeId.value || !barcodes.value.find(item => item.id === defaultBarcodeId.value))) {
		defaultBarcodeId.value = barcodes.value[0].id;
		uni.setStorageSync('defaultBarcodeId', defaultBarcodeId.value);
	}

	const brightnessPreferences = getBrightnessPreferences();
	viewerAutoBrightnessEnabled.value = brightnessPreferences.viewerAuto;
	stationAutoBrightnessEnabled.value = brightnessPreferences.stationAuto;
};

/**
 * 设置应用启动后默认打开的主页面。
 * @param {string} value 启动页标识
 */
const setStartupTab = (value) => {
	startupTab.value = value;
	uni.setStorageSync('startupTab', value);
	uni.showToast({
		title: '启动项已更新',
		icon: 'success',
		duration: 1200
	});
};

/**
 * 使用底部动作面板选择启动首选项。
 */
const chooseStartupTab = () => {
	uni.showActionSheet({
		itemList: startupOptions.map(item => item.label),
		success: (res) => {
			const target = startupOptions[res.tapIndex];
			if (target) {
				setStartupTab(target.value);
			}
		}
	});
};

/**
 * 设置进入驿站后默认展示的子页面。
 * @param {string} value 驿站页面标识
 */
const setStationDefaultPage = (value) => {
	stationDefaultPage.value = value;
	uni.setStorageSync('stationDefaultPage', value);
	uni.showToast({
		title: '驿站默认项已更新',
		icon: 'success',
		duration: 1200
	});
};

/**
 * 使用底部动作面板选择驿站默认展示页。
 */
const chooseStationDefaultPage = () => {
	uni.showActionSheet({
		itemList: stationDefaultOptions.map(item => item.label),
		success: (res) => {
			const target = stationDefaultOptions[res.tapIndex];
			if (target) {
				setStationDefaultPage(target.value);
			}
		}
	});
};

/**
 * 使用底部动作面板选择默认展示的本地条码。
 */
const chooseDefaultBarcode = () => {
	if (!barcodes.value.length) {
		uni.showToast({
			title: '请先添加条码',
			icon: 'none'
		});
		return;
	}

	uni.showActionSheet({
		itemList: barcodes.value.map((item, index) => item.name || `条码 ${index + 1}`),
		success: (res) => {
			const target = barcodes.value[res.tapIndex];
			if (!target) return;

			defaultBarcodeId.value = target.id;
			uni.setStorageSync('defaultBarcodeId', target.id);
			uni.showToast({
				title: '默认条码已更新',
				icon: 'success',
				duration: 1200
			});
		}
	});
};

/**
 * 切换“其他”模块的展开状态。
 */
const toggleOtherExpanded = () => {
	otherExpanded.value = !otherExpanded.value;
};

/**
 * 打开联系方式链接。
 * @param {string} type 联系方式类型
 */
const openContactLink = (type) => {
	const url = contactLinks[type];
	if (!url) return;

	// #ifdef APP-PLUS
	plus.runtime.openURL(url);
	// #endif

	// #ifdef H5
	window.location.href = url;
	// #endif
};

/**
 * 复制微信号到剪贴板。
 */
const copyWechat = () => {
	uni.setClipboardData({
		data: wechatId,
		success: () => {
			uni.showToast({
				title: '微信号已复制',
				icon: 'success'
			});
		}
	});
};

/**
 * 更新某个页面场景的自动点亮开关，并给出提示。
 * @param {string} scene 页面场景
 * @param {boolean} enabled 是否开启
 * @param {string} title 提示文案
 */
const updateAutoBrightnessPreference = (scene, enabled, title) => {
	setSceneAutoBrightnessEnabled(scene, enabled);
	uni.showToast({
		title,
		icon: 'none',
		duration: 1400
	});
};

/**
 * 处理条码页自动点亮开关切换。
 * @param {{ detail: { value: boolean } }} event 开关事件
 */
const handleViewerAutoBrightnessChange = (event) => {
	const enabled = !!event.detail.value;
	viewerAutoBrightnessEnabled.value = enabled;
	updateAutoBrightnessPreference(
		BRIGHTNESS_SCENES.viewer,
		enabled,
		enabled ? '已开启条码页自动点亮' : '已关闭条码页自动点亮'
	);
};

/**
 * 处理驿站页自动点亮开关切换。
 * @param {{ detail: { value: boolean } }} event 开关事件
 */
const handleStationAutoBrightnessChange = (event) => {
	const enabled = !!event.detail.value;
	stationAutoBrightnessEnabled.value = enabled;
	updateAutoBrightnessPreference(
		BRIGHTNESS_SCENES.station,
		enabled,
		enabled ? '已开启驿站页自动点亮' : '已关闭驿站页自动点亮'
	);
};

/**
 * 手动触发检查更新。
 */
const handleCheckUpdate = () => {
	checkForUpdate({
		silent: false,
		force: true
	});
};

/**
 * 清理驿站页相关 WebView 缓存和登录态。
 */
const handleClearStationCache = () => {
	uni.showModal({
		title: '清理驿站缓存',
		content: '这会退出淘宝登录状态，不会删除条码图片和当前设置。是否继续？',
		success: (res) => {
			if (!res.confirm) return;

			clearWebviewSiteData();
			uni.showToast({
				title: '已清理，请重新进入驿站页',
				icon: 'none',
				duration: 1800
			});
		}
	});
};

/**
 * 打开源码仓库链接。
 * @param {string} platform 平台类型
 */
const openSourceLink = (platform) => {
	const urls = {
		github: 'https://github.com/heimenkyou/jingjie',
		gitee: 'https://gitee.com/heimenkyou/jingjie'
	};

	const url = urls[platform];
	if (!url) return;

	// #ifdef APP-PLUS
	plus.runtime.openURL(url);
	// #endif

	// #ifdef H5
	window.open(url, '_blank');
	// #endif
};

onShow(() => {
	// 设置页作为配置中心，每次显示都重新读取最新偏好。
	loadPreferences();
});
</script>

<style scoped>
.content {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	background-color: #f5f5f5;
	position: relative;
}

.header {
	padding: 10px 14px 4px;
}

.subtitle {
	font-size: 12px;
	color: #0f766e;
	display: block;
	background: rgba(16, 185, 129, 0.1);
	border: 1px solid rgba(16, 185, 129, 0.16);
	border-radius: 999px;
	padding: 6px 10px;
}

.settings-body {
	padding: 12px;
}

.feature-section {
	margin-bottom: 12px;
	padding: 12px;
	background: #fff;
	border-radius: 8px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.compact-section {
	padding-top: 10px;
	padding-bottom: 10px;
}

.section-heading {
	margin-bottom: 10px;
}

.section-heading-inline {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 10px;
}

.section-title {
	font-size: 16px;
	font-weight: bold;
	color: #111827;
	display: block;
	margin-bottom: 3px;
}

.section-desc {
	font-size: 11px;
	color: #888;
	line-height: 1.4;
	display: block;
	flex-shrink: 0;
}

.setting-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 11px 0;
}

.setting-row+.setting-row {
	border-top: 1px solid #eee;
}

.setting-row-child {
	padding-left: 16px;
}

.setting-row-title {
	font-size: 14px;
	color: #333;
	font-weight: 500;
	line-height: 1.4;
}

.setting-row-value {
	display: flex;
	align-items: center;
	gap: 6px;
	flex-shrink: 0;
}

.setting-row-text {
	font-size: 13px;
	color: #10b981;
	line-height: 1;
}

.setting-row-text.subtle {
	color: #8a8f98;
}

.setting-row-arrow {
	font-size: 12px;
	color: #a1a1aa;
	line-height: 1;
}

.toggle-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 8px 0;
}

.toggle-row+.toggle-row {
	border-top: 1px solid #eee;
}

.toggle-copy {
	flex: 1;
	min-width: 0;
}

.toggle-title {
	font-size: 14px;
	font-weight: 500;
	color: #333;
	display: block;
}

.other-content {
	padding-top: 2px;
}

.info-section {
	margin-top: 10px;
	padding: 12px;
	background-color: #f9f9f9;
	border-radius: 8px;
}

.info-text {
	font-size: 12px;
	color: #666;
	display: block;
	line-height: 1.65;
	margin-bottom: 2px;
}

.about-section {
	margin-top: 10px;
	background: rgba(255, 255, 255, 0.6);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
	border-radius: 12px;
	padding: 16px;
	border: 1px solid rgba(16, 185, 129, 0.1);
}

.about-block {
	margin-bottom: 10px;
}

.about-text {
	font-size: 12px;
	color: #666;
	line-height: 1.55;
	display: block;
}

.divider {
	height: 1px;
	background: linear-gradient(to right, transparent, rgba(16, 185, 129, 0.3), transparent);
	margin: 14px 0;
}

.author-section {
	margin-bottom: 12px;
	text-align: center;
}

.author-title {
	font-size: 14px;
	font-weight: 600;
	color: #333;
	display: block;
	margin-bottom: 8px;
}

.author-collab {
	font-size: 13px;
	color: #10b981;
	font-weight: 500;
	display: block;
	margin-bottom: 6px;
}

.contact-section {
	background: rgba(16, 185, 129, 0.05);
	border-radius: 8px;
	padding: 10px;
	text-align: center;
}

.contact-title {
	font-size: 13px;
	font-weight: 600;
	color: #333;
	display: block;
	margin-bottom: 6px;
}

.contact-item {
	font-size: 12px;
	color: #666;
	display: block;
	line-height: 1.65;
}

.contact-link {
	color: #10b981;
}

.source-section {
	background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%);
	border-radius: 8px;
	padding: 10px;
	margin-top: 10px;
}

.source-title {
	font-size: 13px;
	font-weight: 600;
	color: #333;
	display: block;
	margin-bottom: 4px;
	text-align: center;
}

.source-hint {
	font-size: 11px;
	color: #999;
	display: block;
	text-align: center;
	margin-bottom: 10px;
}

.source-links {
	display: flex;
	justify-content: center;
	gap: 12px;
}

.source-link {
	flex: 1;
	max-width: 110px;
	background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
	border-radius: 8px;
	padding: 8px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 3px;
	box-shadow: 0 2px 6px rgba(16, 185, 129, 0.2);
	transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.source-link:active {
	transform: scale(0.95);
	box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3);
}

.link-icon {
	width: 28px;
	height: 28px;
	display: block;
}
</style>
