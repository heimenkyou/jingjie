<template>
	<view class="container">
		<swiper class="swiper" :indicator-dots="barcodes.length > 1" :autoplay="false" :duration="300"
			indicator-color="rgba(255,255,255,0.3)" indicator-active-color="#10b981">
			<swiper-item v-for="(item, index) in barcodes" :key="item.id">
				<view class="swiper-item">
					<image class="barcode-image" :src="item.imageData" mode="aspectFit"></image>
					<view class="label-container">
						<text class="barcode-label">{{ item.name || '条码 ' + (index + 1) }}</text>
					</view>
				</view>
			</swiper-item>
		</swiper>

		<!-- 亮度提示 -->
		<view class="brightness-tip" v-if="barcodes.length > 0 && showBrightnessTip">
			<text class="tip-text">✨ 已为您自动调整至最高亮度</text>
		</view>

		<!-- 引导卡片 - 空状态 -->
		<view class="onboarding-overlay" v-if="barcodes.length === 0">
			<view class="onboarding-card">
				<text class="card-title">🚀 开启"快人一步"的体验</text>

				<view class="steps">
					<view class="step-item">
						<view class="step-number">1</view>
						<view class="step-content">
							<text class="step-title">截取条码</text>
							<text class="step-desc">前往"多彩校园"截取饮水机或吹风机的条码（建议先展开条码再截图）</text>
						</view>
					</view>

					<view class="step-item">
						<view class="step-number">2</view>
						<view class="step-content">
							<text class="step-title">上传保存</text>
							<text class="step-desc">在"设置"页上传截图，一劳永逸</text>
						</view>
					</view>

					<view class="step-item">
						<view class="step-number">3</view>
						<view class="step-content">
							<text class="step-title">即刻使用</text>
							<text class="step-desc">下次口渴或吹头时，点开本应用即刻扫码</text>
						</view>
					</view>
				</view>

				<view class="note">
					<text class="note-text">💡 本应用将自动为您开启最高亮度，无需手动调节</text>
				</view>

				<button class="btn-start" @click="goToSettings">前往设置</button>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';

const barcodes = ref([]);
const showBrightnessTip = ref(false);

/**
 * 从本地存储加载条码数据
 */
const loadBarcodes = () => {
	const data = uni.getStorageSync('barcodes');
	console.log('viewer加载条码:', data);
	barcodes.value = data || [];
	console.log('viewer当前条码数量:', barcodes.value.length);
};

/**
 * 跳转到设置页
 */
const goToSettings = () => {
	uni.switchTab({
		url: '/pages/settings/index'
	});
};

onMounted(() => {
	loadBarcodes();
});

onShow(() => {
	// 设置屏幕亮度为最大
	// #ifdef APP-PLUS
	uni.setScreenBrightness({
		value: 1
	});
	// #endif

	// 每次显示时重新加载数据
	loadBarcodes();

	// 显示亮度提示（淡入淡出）
	if (barcodes.value.length > 0) {
		showBrightnessTip.value = true;
		setTimeout(() => {
			showBrightnessTip.value = false;
		}, 3000);
	}
});

onHide(() => {
	// 恢复系统默认亮度
	// #ifdef APP-PLUS
	uni.setScreenBrightness({
		value: 0.5
	});
	// #endif
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
.onboarding-overlay {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.85);
}

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

.step-title {
	font-size: 16px;
	font-weight: 600;
	color: #10b981;
	display: block;
	margin-bottom: 6px;
}

.step-desc {
	font-size: 14px;
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
