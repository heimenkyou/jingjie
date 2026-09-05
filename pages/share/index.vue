<template>
	<view class="share-container">
		<view class="share-card">
			<image class="qrcode-img" src="/static/share.webp" mode="widthFix" @longpress="handleLongPress"></image>
			<text class="share-tip">长按可保存二维码</text>
		</view>
		<UpdateDownloadDialog />
		<AppFeedback />
	</view>
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app';
import { trackPage } from '@/utils/analytics.js';
import { showActionSheet, showToast } from '@/utils/feedback.js';
import UpdateDownloadDialog from '@/components/UpdateDownloadDialog.vue';
import AppFeedback from '@/components/AppFeedback.vue';

/**
 * 处理二维码长按事件
 */
const handleLongPress = () => {
	showActionSheet({
		itemList: ['保存图片到相册']
	}).then((selected) => {
		if (selected === 0) {
			saveImage();
		}
	});
};

/**
 * 保存本地图片到相册
 */
const saveImage = () => {
	uni.saveImageToPhotosAlbum({
		filePath: '/static/share.webp',
		success: () => {
			showToast({
				title: '已保存到相册',
				icon: 'success'
			});
		},
		fail: (err) => {
			console.error('保存失败', err);
			showToast({
				title: '保存失败或已取消',
				icon: 'none'
			});
		}
	});
};

onShow(() => {
	trackPage('/pages/share/index');
});
</script>

<style scoped>
.share-container {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	background-color: #F3F7FA;
	justify-content: center;
	align-items: center;
}

.share-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

.qrcode-img {
	width: 100vw;
	height: auto;
	margin-bottom: 40px;
}

.share-tip {
	font-size: 16px;
	color: #243447;
	font-weight: 500;
}
</style>
