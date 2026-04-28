<template>
	<view class="container">
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
			indicator-active-color="#10b981"
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

const barcodes = ref([]);
const showBrightnessTip = ref(false);
const brightnessTipText = ref('✨ 已自动调亮屏幕');
const currentIndex = ref(0);
const isBrightnessBoosted = ref(false);
let brightnessTipTimer = null;

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
const confirmManualBrightnessToggle = () =>
	new Promise((resolve) => {
		if (!shouldShowManualBrightnessHint()) {
			resolve(true);
			return;
		}

		uni.showModal({
			title: '点亮屏幕',
			content: '点击后会临时拉满屏幕亮度，方便扫码。您也可以在设置里开启“条码页自动点亮”。',
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
 * 新增条码，并在成功后提示用户可点击名称继续管理。
 */
const addBarcode = () => {
	uni.chooseImage({
		count: 1,
		sizeType: ['compressed'],
		sourceType: ['album', 'camera'],
		success: (res) => {
			const tempFilePath = res.tempFilePaths[0];

			const finishAdd = (finalPath) => {
				const newBarcode = {
					id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					name: '',
					imageData: finalPath
				};

				barcodes.value.push(newBarcode);
				if (barcodes.value.length === 1) {
					uni.setStorageSync('defaultBarcodeId', newBarcode.id);
				}
				const nextIndex = Math.max(0, barcodes.value.length - 1);
				persistBarcodes(nextIndex);
				uni.showToast({
					title: '添加成功，点击名称可编辑或删除',
					icon: 'none',
					duration: 2200
				});
			};

			// #ifdef APP-PLUS
			const savedFileName = `${Date.now()}.jpg`;
			plus.io.resolveLocalFileSystemURL('_doc', (entry) => {
				entry.getDirectory('barcodes', { create: true }, (dirEntry) => {
					plus.io.resolveLocalFileSystemURL(tempFilePath, (fileEntry) => {
						fileEntry.copyTo(dirEntry, savedFileName, (newEntry) => {
							finishAdd(newEntry.toLocalURL());
						}, () => {
							uni.showToast({
								title: '保存失败',
								icon: 'error'
							});
						});
					});
				});
			});
			// #endif

			// #ifndef APP-PLUS
			finishAdd(tempFilePath);
			// #endif
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
	uni.showToast({
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
	uni.showModal({
		title: '确认删除',
		content: '确定要删除这个条码吗？',
		success: (res) => {
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
			uni.showToast({
				title: '删除成功',
				icon: 'success'
			});
		}
	});
};

/**
 * 重命名指定索引的条码。
 * @param {number} index 条码索引
 */
const renameBarcode = (index) => {
	const currentBarcode = barcodes.value[index];
	if (!currentBarcode) return;

	uni.showModal({
		title: '修改名称',
		content: '请输入新名称',
		editable: true,
		placeholderText: currentBarcode.name || `条码 ${index + 1}`,
		success: (res) => {
			if (!res.confirm || !res.content) return;
			currentBarcode.name = res.content.trim();
			persistBarcodes(index);
			uni.showToast({
				title: '修改成功',
				icon: 'success'
			});
		}
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

	uni.showActionSheet({
		itemList: actions,
		success: (res) => {
			const action = actions[res.tapIndex];
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
		}
	});
};

onShow(() => {
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
	background-color: #000;
	position: relative;
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
	background: rgba(16, 185, 129, 0.9);
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

/* 引导卡片 */
.onboarding-card {
	background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%);
	backdrop-filter: blur(20px);
	border-radius: 24px;
	padding: 32px 24px;
	width: 100%;
	max-width: 100%;
	box-sizing: border-box;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.card-title {
	font-size: 24px;
	font-weight: bold;
	color: #fff;
	display: block;
	margin-bottom: 28px;
	text-align: center;
}

.steps {
	margin-bottom: 24px;
}

.step-item {
	display: flex;
	margin-bottom: 20px;
	align-items: flex-start;
}

.step-number {
	width: 32px;
	height: 32px;
	background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
	font-weight: bold;
	color: #fff;
	flex-shrink: 0;
	margin-right: 16px;
}

.step-content {
	flex: 1;
	padding-top: 2px;
}

.step-line {
	font-size: 15px;
	font-weight: 500;
	color: rgba(255, 255, 255, 0.8);
	line-height: 1.6;
	display: block;
}

.note {
	background: rgba(16, 185, 129, 0.15);
	border-left: 3px solid #10b981;
	padding: 12px 16px;
	border-radius: 8px;
	margin-bottom: 24px;
}

.note-text {
	font-size: 13px;
	color: rgba(255, 255, 255, 0.85);
	line-height: 1.5;
}

.btn-start {
	width: 100%;
	background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
	color: #fff;
	border: none;
	border-radius: 16px;
	font-size: 17px;
	font-weight: 600;
	padding: 16px;
	box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}
</style>
