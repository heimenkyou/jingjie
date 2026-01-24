<template>
	<view class="container">
		<swiper class="swiper" :indicator-dots="barcodes.length > 1" :autoplay="false" :duration="300"
			indicator-color="rgba(255,255,255,0.3)" indicator-active-color="#ffffff">
			<swiper-item v-for="(item, index) in barcodes" :key="item.id">
				<view class="swiper-item">
					<image class="barcode-image" :src="item.imageData" mode="aspectFit"></image>
					<view class="label-container">
						<text class="barcode-label">{{ item.name || '条码 ' + (index + 1) }}</text>
					</view>
				</view>
			</swiper-item>
		</swiper>

		<!-- 空状态 -->
		<view class="empty-container" v-if="barcodes.length === 0">
			<text class="empty-icon">📷</text>
			<text class="empty-text">暂无条码</text>
			<button class="btn-goto-settings" @click="goToSettings">前往添加</button>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';

const barcodes = ref([]);

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
 * 显示添加条码提示
 */
const showAddTip = () => {
	uni.showModal({
		title: '提示',
		content: '暂无条码，请前往设置页添加',
		showCancel: false,
		confirmText: '前往添加',
		success: (res) => {
			if (res.confirm) {
				goToSettings();
			}
		}
	});
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

	// 如果没有条码，提示用户
	if (barcodes.value.length === 0) {
		setTimeout(() => {
			showAddTip();
		}, 500);
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
	bottom: 20px;
	background: rgba(0, 0, 0, 0.5);
	padding: 8px 16px;
	border-radius: 20px;
}

.barcode-label {
	font-size: 14px;
	color: rgba(255, 255, 255, 0.9);
}

.empty-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	width: 100%;
}

.empty-icon {
	font-size: 64px;
	margin-bottom: 20px;
}

.empty-text {
	font-size: 18px;
	color: rgba(255, 255, 255, 0.6);
	margin-bottom: 30px;
}

.btn-goto-settings {
	background-color: #667eea;
	color: white;
	border: none;
	border-radius: 20px;
	padding: 12px 30px;
	font-size: 16px;
}
</style>
