<script setup>
import { computed } from 'vue';
import {
	hideUpdateDownloadProgress,
	openOfficialDownloadPage,
	resolveUpdatePrompt,
	updatePrompt,
	updateDownloadProgress
} from '@/utils/updateChecker.js';

const formatSize = (bytes) => {
	if (!bytes) return '0 B';
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const progressDetail = computed(() => {
	const { downloadedSize, totalSize } = updateDownloadProgress.value;
	if (!totalSize) return `${formatSize(downloadedSize)} · 正在获取文件大小`;
	return `${formatSize(downloadedSize)} / ${formatSize(totalSize)}`;
});

const progressWidth = computed(() => `${updateDownloadProgress.value.percent}%`);
</script>

<template>
	<view v-if="updatePrompt.visible" class="update-download-dialog">
		<view class="update-download-card update-prompt-card">
			<text class="update-download-title">{{ updatePrompt.title }}</text>
			<text class="update-prompt-content">{{ updatePrompt.content }}</text>
			<view class="update-prompt-actions">
				<text v-if="updatePrompt.showCancel" class="update-download-hide" @click="resolveUpdatePrompt(false)">{{ updatePrompt.cancelText }}</text>
				<text class="update-prompt-confirm" @click="resolveUpdatePrompt(true)">{{ updatePrompt.confirmText }}</text>
			</view>
		</view>
	</view>

	<view v-else-if="updateDownloadProgress.visible" class="update-download-dialog">
		<view class="update-download-card">
			<text class="update-download-title">正在下载更新</text>
			<text class="update-download-percent">{{ updateDownloadProgress.percent }}%</text>
			<view class="update-download-track">
				<view class="update-download-bar" :style="{ width: progressWidth }"></view>
			</view>
			<text class="update-download-detail">{{ progressDetail }}</text>
			<text class="update-download-hint">下载可在后台继续，完成后会提示安装。</text>
			<view class="update-download-actions">
				<text class="update-download-link" @click="openOfficialDownloadPage">官网手动下载</text>
				<text class="update-download-hide" @click="hideUpdateDownloadProgress">转入后台</text>
			</view>
		</view>
	</view>
</template>

<style scoped>
.update-download-dialog {
	position: fixed;
	inset: 0;
	z-index: 9999;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 32rpx;
	background: rgba(23, 38, 52, 0.32);
}

.update-download-card {
	width: 100%;
	max-width: 560rpx;
	padding: 40rpx;
	border-radius: 28rpx;
	background: #ffffff;
	box-shadow: 0 24rpx 64rpx rgba(25, 53, 71, 0.2);
}

.update-download-title {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: #243447;
}

.update-prompt-card {
	padding-bottom: 30rpx;
}

.update-prompt-content {
	display: block;
	margin-top: 24rpx;
	font-size: 26rpx;
	line-height: 1.65;
	white-space: pre-line;
	color: #4c6170;
}

.update-download-percent {
	display: block;
	margin-top: 20rpx;
	font-size: 56rpx;
	font-weight: 700;
	line-height: 1;
	color: #3b91a8;
}

.update-download-track {
	height: 16rpx;
	margin-top: 28rpx;
	overflow: hidden;
	border-radius: 999rpx;
	background: #dcecf0;
}

.update-download-bar {
	height: 100%;
	border-radius: inherit;
	background: linear-gradient(90deg, #3b91a8, #76c6d2);
	transition: width 0.2s linear;
}

.update-download-detail,
.update-download-hint {
	display: block;
	margin-top: 20rpx;
	font-size: 24rpx;
	color: #68798a;
}

.update-download-hint {
	margin-top: 10rpx;
	font-size: 22rpx;
}

.update-download-actions {
	display: flex;
	justify-content: space-between;
	margin-top: 34rpx;
	font-size: 26rpx;
	font-weight: 500;
}

.update-prompt-actions {
	display: flex;
	justify-content: flex-end;
	gap: 40rpx;
	margin-top: 42rpx;
	font-size: 28rpx;
	font-weight: 600;
}

.update-prompt-confirm {
	color: #3b91a8;
}

.update-download-link {
	color: #3b91a8;
}

.update-download-hide {
	color: #68798a;
}
</style>
