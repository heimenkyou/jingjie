<template>
	<view class="container" :style="backgroundStyle">
		<!-- #ifdef APP-PLUS -->
		<GlobalNoticeBar />
		<!-- #endif -->

		<view
			v-if="barcodes.length > 0"
			class="brightness-toggle"
			:class="{ active: isBrightnessBoosted }"
			@click="handleBrightnessToggle"
		>
			<text class="brightness-toggle-icon">{{ isBrightnessBoosted ? '☀' : '◐' }}</text>
			<text class="brightness-toggle-text">{{ isBrightnessBoosted ? '恢复亮度' : '点亮屏幕' }}</text>
		</view>

		<swiper
			class="swiper"
			:current="currentIndex"
			:indicator-dots="viewerSlides.length > 1"
			:autoplay="false"
			:duration="300"
			indicator-color="rgba(255,255,255,0.3)"
			indicator-active-color="#3B91A8"
			@change="handleSwiperChange"
		>
			<swiper-item v-for="(item, index) in viewerSlides" :key="item.id">
				<view v-if="item.type === 'barcode'" class="swiper-item">
					<image class="barcode-image" :src="item.imageData" mode="aspectFit"></image>
					<view class="label-container" @click="handleBarcodeActions(item, index)">
						<text class="barcode-label">{{ item.name || '点此编辑/删除' }}</text>
					</view>
				</view>

				<view v-else class="swiper-item swiper-item-add">
					<view class="onboarding-card">
						<text class="card-title">{{ barcodes.length === 0 ? '📷 添加第一张条码' : '➕ 添加条码' }}</text>

						<view class="steps">
							<view class="step-item">
								<view class="step-number">1</view>
								<view class="step-content">
									<text class="step-line">去“多彩校园”截图</text>
								</view>
							</view>

							<view class="step-item">
								<view class="step-number">2</view>
								<view class="step-content">
									<text class="step-line">来这添加</text>
								</view>
							</view>

							<view class="step-item">
								<view class="step-number">3</view>
								<view class="step-content">
									<text class="step-line">点击名称编辑/删除/设为默认</text>
								</view>
							</view>
						</view>

						<view class="note">
							<text class="note-text">💡 右下角点亮屏幕，去设置可开启自动点亮</text>
						</view>

						<button class="btn-start" @click="addBarcode">添加条码</button>
					</view>
				</view>
			</swiper-item>
		</swiper>

		<!-- #ifndef APP-PLUS -->
		<!-- 亮度提示 -->
		<view class="brightness-tip" v-if="barcodes.length > 0 && showBrightnessTip">
			<text class="tip-text">{{ brightnessTipText }}</text>
		</view>
		<!-- #endif -->
		<UpdateDownloadDialog />
		<AppFeedback />


	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
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
import { ANALYTICS_EVENTS, track, trackPage } from '@/utils/analytics.js';
import { getBackgroundImage } from '@/utils/background.js';
import { showActionSheet, showModal, showToast } from '@/utils/feedback.js';
import UpdateDownloadDialog from '@/components/UpdateDownloadDialog.vue';
import AppFeedback from '@/components/AppFeedback.vue';

const barcodes = ref([]);
const showBrightnessTip = ref(false);
const brightnessTipText = ref('✨ 已自动调亮屏幕');
const currentIndex = ref(0);
const isBrightnessBoosted = ref(false);
const backgroundImage = ref(getBackgroundImage());
let brightnessTipTimer = null;

const backgroundStyle = computed(() => ({
	'--page-background-image': `url("${backgroundImage.value}")`
}));

/**
 * 条码页的轮播数据，末尾始终追加一个“添加条码”卡片。
 */
const viewerSlides = computed(() => {
	const barcodeSlides = barcodes.value.map(item => ({
		...item,
		type: 'barcode'
	}));

	return [
		...barcodeSlides,
		{
			id: '__add_barcode__',
			type: 'add'
		}
	];
});

/**
 * 从本地存储加载条码数据
 */
const loadBarcodes = () => {
	const data = uni.getStorageSync('barcodes');
	let loadedBarcodes = data || [];

	// 加载默认条码ID
	const defaultBarcodeId = uni.getStorageSync('defaultBarcodeId');

	// 如果有默认条码，将其移动到数组第一位
	if (defaultBarcodeId && loadedBarcodes.length > 0) {
		const defaultIndex = loadedBarcodes.findIndex(b => b.id === defaultBarcodeId);
		if (defaultIndex > 0) {
			const defaultBarcode = loadedBarcodes.splice(defaultIndex, 1)[0];
			loadedBarcodes.unshift(defaultBarcode);
		}
	}

	barcodes.value = loadedBarcodes;
	currentIndex.value = 0; // 总是从第一张开始
};

/**
 * 展示条码页亮度提示，App 端优先使用原生 toast。
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
	if (brightnessTipTimer) {
		clearTimeout(brightnessTipTimer);
	}
	brightnessTipTimer = setTimeout(() => {
		showBrightnessTip.value = false;
	}, 3000);
};

/**
 * 同步当前条码页是否处于高亮状态。
 */
const syncBrightnessBoostedState = () => {
	isBrightnessBoosted.value = isSceneBrightnessBoosted(BRIGHTNESS_SCENES.viewer);
};

/**
 * 首次手动点亮前给用户一个温和提醒。
 * @returns {Promise<boolean>}
 */
const confirmManualBrightnessToggle = async () => {
	if (!shouldShowManualBrightnessHint()) return true;

	const res = await showModal({
		title: '点亮屏幕',
		content: '点击后会临时拉满屏幕亮度，方便扫码。您也可以在设置里开启“条码页自动点亮”。',
		confirmText: '继续'
	});
	if (res.confirm) {
		markManualBrightnessHintShown();
		return true;
	}
	return false;
};

/**
 * 处理右下角亮度按钮点击，支持一键拉满和恢复。
 */
const handleBrightnessToggle = async () => {
	if (!isBrightnessBoosted.value) {
		const confirmed = await confirmManualBrightnessToggle();
		if (!confirmed) return;
	}

	const boosted = await toggleSceneBrightness(BRIGHTNESS_SCENES.viewer);
	syncBrightnessBoostedState();
	showBrightnessNotice(
		boosted
			? '✨ 已手动拉满亮度，可在设置中开启条码页自动点亮'
			: '已恢复原亮度'
	);
};

/**
 * 处理轮播切换，记录当前所在页。
 * @param {{ detail: { current: number } }} event 轮播事件
 */
const handleSwiperChange = (event) => {
	currentIndex.value = event.detail.current || 0;
};

/**
 * 将当前条码列表写回本地，并重新按默认项排序。
 * @param {number} [nextIndex=0] 重新加载后定位到的轮播索引
 */
const persistBarcodes = (nextIndex = 0) => {
	uni.setStorageSync('barcodes', barcodes.value);
	loadBarcodes();
	currentIndex.value = nextIndex;
};

/**
 * 将临时图片复制到应用私有目录，避免相册缓存被清理后条码失效。
 * @param {string} tempFilePath 临时图片路径
 * @param {string} fileName 保存后的文件名
 * @returns {Promise<string>} 保存后的本地路径，失败时为空字符串
 */
const saveBarcodeImage = (tempFilePath, fileName) => {
	return new Promise((resolve) => {
		// #ifdef APP-PLUS
		plus.io.resolveLocalFileSystemURL('_doc', (entry) => {
			entry.getDirectory('barcodes', { create: true }, (dirEntry) => {
				plus.io.resolveLocalFileSystemURL(tempFilePath, (fileEntry) => {
					fileEntry.copyTo(dirEntry, fileName, (newEntry) => {
						resolve(newEntry.toLocalURL());
					}, () => resolve(''));
				}, () => resolve(''));
			}, () => resolve(''));
		}, () => resolve(''));
		// #endif

		// #ifndef APP-PLUS
		resolve(tempFilePath);
		// #endif
	});
};

/**
 * 新增一张或多张条码，并在成功后提示用户可点击名称继续管理。
 */
const addBarcode = () => {
	uni.chooseImage({
		count: 9,
		sizeType: ['compressed'],
		sourceType: ['album', 'camera'],
		success: async (res) => {
			const savedPaths = await Promise.all(
				res.tempFilePaths.map((tempFilePath, index) => saveBarcodeImage(
					tempFilePath,
					`${Date.now()}_${index}_${Math.random().toString(36).slice(2, 11)}.jpg`
				))
			);
			const newBarcodes = savedPaths
				.filter(Boolean)
				.map((imageData) => ({
					id: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
					name: '',
					imageData
				}));

			if (!newBarcodes.length) {
				showToast({ title: '保存失败', icon: 'error' });
				return;
			}

			const hasNoBarcode = barcodes.value.length === 0;
			barcodes.value.push(...newBarcodes);
			if (hasNoBarcode) {
				uni.setStorageSync('defaultBarcodeId', newBarcodes[0].id);
			}
			persistBarcodes(barcodes.value.length - 1);
			track(ANALYTICS_EVENTS.barcodeAdd);
			showToast({
				title: `已添加 ${newBarcodes.length} 张条码，点击名称可编辑或删除`,
				icon: 'none',
				duration: 2200
			});
		}
	});
};

/**
 * 将指定条码设为默认展示项。
 * @param {string} barcodeId 条码 ID
 */
const setDefaultBarcode = (barcodeId) => {
	uni.setStorageSync('defaultBarcodeId', barcodeId);
	loadBarcodes();
	currentIndex.value = 0;
	showToast({
		title: '已设为默认',
		icon: 'success',
		duration: 1500
	});
};

/**
 * 删除指定索引的条码。
 * @param {number} index 条码索引
 */
const deleteBarcode = (index) => {
	showModal({
		title: '确认删除',
		content: '确定要删除这个条码吗？'
	}).then((res) => {
		if (!res.confirm) return;

		const deletedId = barcodes.value[index]?.id;
		barcodes.value.splice(index, 1);
		const defaultBarcodeId = uni.getStorageSync('defaultBarcodeId') || '';
		if (deletedId === defaultBarcodeId) {
			if (barcodes.value.length > 0) {
				uni.setStorageSync('defaultBarcodeId', barcodes.value[0].id);
			} else {
				uni.removeStorageSync('defaultBarcodeId');
			}
		}

		persistBarcodes(Math.max(0, Math.min(index, barcodes.value.length - 1)));
		showToast({
			title: '删除成功',
			icon: 'success'
		});
	});
};

/**
 * 重命名指定索引的条码。
 * @param {number} index 条码索引
 */
const renameBarcode = (index) => {
	const currentBarcode = barcodes.value[index];
	if (!currentBarcode) return;

	showModal({
		title: '修改名称',
		content: '请输入新名称',
		editable: true,
		placeholderText: currentBarcode.name || `条码 ${index + 1}`
	}).then((res) => {
		if (!res.confirm || !res.content) return;
		currentBarcode.name = res.content.trim();
		persistBarcodes(index);
		showToast({
			title: '修改成功',
			icon: 'success'
		});
	});
};

/**
 * 点击条码名称后弹出操作菜单，支持重命名、删除和设为默认。
 * @param {{ id: string }} item 条码数据
 * @param {number} index 条码索引
 */
const handleBarcodeActions = (item, index) => {
	if (!item?.id) return;

	const defaultBarcodeId = uni.getStorageSync('defaultBarcodeId') || '';
	const actions = ['重命名', '删除'];
	if (defaultBarcodeId !== item.id) {
		actions.unshift('设为默认');
	}

	showActionSheet({
		itemList: actions
	}).then((selected) => {
			const action = actions[selected];
			if (action === '设为默认') {
				setDefaultBarcode(item.id);
				return;
			}
			if (action === '重命名') {
				renameBarcode(index);
				return;
			}
			if (action === '删除') {
				deleteBarcode(index);
			}
		});
};

onShow(() => {
	trackPage('/pages/viewer/index');
	backgroundImage.value = getBackgroundImage();
	// 条码页每次显示都重新读取条码和亮度状态，避免设置页改动不同步。
	loadBarcodes();
	syncBrightnessBoostedState();

	// 只有存在条码时才有必要自动点亮屏幕。
	if (barcodes.value.length > 0 && isSceneAutoBrightnessEnabled(BRIGHTNESS_SCENES.viewer)) {
		boostSceneBrightness(BRIGHTNESS_SCENES.viewer).then(() => {
			syncBrightnessBoostedState();
			showBrightnessNotice('✨ 已自动调亮屏幕');
		});
	}
});

onHide(() => {
	if (brightnessTipTimer) {
		clearTimeout(brightnessTipTimer);
		brightnessTipTimer = null;
	}
	showBrightnessTip.value = false;

	// 离开条码页时恢复进入前的原始亮度。
	restoreSceneBrightness(BRIGHTNESS_SCENES.viewer).finally(() => {
		syncBrightnessBoostedState();
	});
});
</script>

<style scoped>
.container {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100vh;
	width: 100vw;
	background-color: #F3F7FA;
	background-image: var(--page-background-image);
	background-position: center;
	background-size: auto 100vh;
	background-repeat: no-repeat;
	background-attachment: fixed;
	position: relative;
	overflow: hidden;
}

.container::before {
	content: '';
	position: fixed;
	inset: -14px;
	z-index: 0;
	background-color: #F3F7FA;
	background-image: var(--page-background-image);
	background-position: center;
	background-size: auto 100vh;
	background-repeat: no-repeat;
	filter: blur(10px);
}

.brightness-toggle {
	position: absolute;
	right: 14px;
	bottom: 44px;
	z-index: 25;
	display: flex;
	align-items: center;
	gap: 9px;
	padding: 13px 17px;
	border-radius: 999px;
	background: rgba(15, 23, 42, 0.72);
	border: 1px solid rgba(255, 255, 255, 0.16);
	backdrop-filter: blur(10px);
}

.brightness-toggle.active {
	background: rgba(59, 145, 168, 0.9);
}

.brightness-toggle-icon {
	font-size: 17px;
	color: #fff;
	line-height: 1;
}

.brightness-toggle-text {
	font-size: 14px;
	color: #fff;
	line-height: 1;
}

.swiper {
	position: relative;
	z-index: 1;
	height: 100%;
	width: 100%;
}

.swiper-item {
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	height: 100%;
	color: #fff;
	padding: 0;
}

.swiper-item-add {
	padding: 18px;
	box-sizing: border-box;
}

.barcode-image {
	width: 100%;
	height: 100%;
}

.label-container {
	position: absolute;
	bottom: 60px;
	background: rgba(0, 0, 0, 0.6);
	padding: 10px 20px;
	border-radius: 25px;
	backdrop-filter: blur(10px);
}

.barcode-label {
	font-size: 15px;
	color: rgba(255, 255, 255, 0.95);
	font-weight: 500;
}

/* 亮度提示 */
.brightness-tip {
	position: absolute;
	bottom: 20px;
	left: 50%;
	transform: translateX(-50%);
	background: rgba(59, 145, 168, 0.9);
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

/* 引导卡片 */
.onboarding-card {
	background: rgba(255, 255, 255, 0.82);
	border-radius: 16px;
	padding: 24px 20px;
	width: 100%;
	max-width: 100%;
	box-sizing: border-box;
	border: 1px solid rgba(59, 145, 168, 0.16);
	box-shadow: 0 3px 10px rgba(36, 52, 71, 0.06);
}

.card-title {
	font-size: 20px;
	font-weight: 700;
	color: #243447;
	display: block;
	margin-bottom: 22px;
}

.steps {
	margin-bottom: 18px;
}

.step-item {
	display: flex;
	margin-bottom: 16px;
	align-items: flex-start;
}

.step-number {
	width: 28px;
	height: 28px;
	background: linear-gradient(135deg, #3B91A8 0%, #76C6D2 100%);
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 14px;
	font-weight: bold;
	color: #fff;
	flex-shrink: 0;
	margin-right: 12px;
}

.step-content {
	flex: 1;
	padding-top: 2px;
}

.step-line {
	font-size: 14px;
	font-weight: 500;
	color: #243447;
	line-height: 1.6;
	display: block;
}

.note {
	background: rgba(118, 198, 210, 0.14);
	border-left: 3px solid #3B91A8;
	padding: 10px 12px;
	border-radius: 14px;
	margin-bottom: 18px;
}

.note-text {
	font-size: 13px;
	color: #68798A;
	line-height: 1.5;
}

.btn-start {
	width: 100%;
	background: linear-gradient(135deg, #3B91A8 0%, #76C6D2 100%);
	color: #fff;
	border: none;
	border-radius: 14px;
	font-size: 16px;
	font-weight: 600;
	padding: 16px;
	box-shadow: 0 4px 12px rgba(59, 145, 168, 0.16);
}
</style>
