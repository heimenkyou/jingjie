<template>
	<view class="share-container">
		<view class="share-card">
			<image class="qrcode-img" src="/static/share-qrcode.png" mode="widthFix" @longpress="handleLongPress"></image>
			<text class="share-tip">长按可保存二维码</text>
		</view>
	</view>
</template>

<script setup>
/**
 * 处理二维码长按事件
 */
const handleLongPress = () => {
	uni.showActionSheet({
		itemList: ['保存图片到相册'],
		success: (res) => {
			if (res.tapIndex === 0) {
				saveImage();
			}
		}
	});
};

/**
 * 保存本地图片到相册
 */
const saveImage = () => {
	uni.saveImageToPhotosAlbum({
		filePath: '/static/share-qrcode.png',
		success: () => {
			uni.showToast({
				title: '已保存到相册',
				icon: 'success'
			});
		},
		fail: (err) => {
			console.error('保存失败', err);
			uni.showToast({
				title: '保存失败或已取消',
				icon: 'none'
			});
		}
	});
};
</script>

<style scoped>
.share-container {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	background-color: #ffffff;
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
	color: #333;
	font-weight: 500;
}
</style>
