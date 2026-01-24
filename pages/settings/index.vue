<template>
	<view class="content">
		<view class="header">
			<text class="title">条码管理</text>
			<text class="subtitle">添加您的饮水机和吹风机条码</text>
		</view>
		
		<!-- 条码列表 -->
		<view class="barcode-list" v-if="barcodes.length > 0">
			<view class="barcode-item" v-for="(item, index) in barcodes" :key="item.id">
				<image class="barcode-image" :src="item.imageData" mode="aspectFit"></image>
				<view class="barcode-info">
					<text class="barcode-name">{{ item.name || '条码 ' + (index + 1) }}</text>
				</view>
				<view class="barcode-actions">
					<button class="btn-delete" @click="deleteBarcode(index)">删除</button>
				</view>
			</view>
		</view>
		
		<!-- 空状态 -->
		<view class="empty-state" v-else>
			<text class="empty-text">📷 暂无条码</text>
			<text class="empty-hint">点击下方按钮添加您的第一个条码</text>
		</view>
        
		<!-- 底部操作区 -->
		<view class="footer">
			<button class="btn-add" type="primary" @click="addBarcode">+ 添加条码</button>
			<view class="info-section">
				<text class="info-title">使用说明</text>
				<text class="info-text">1. 点击"添加条码"上传图片</text>
				<text class="info-text">2. 在条码展示页左右滑动切换</text>
				<text class="info-text">3. 应用会自动调节屏幕亮度至最高</text>
			</view>
			<text class="desc">开发者：Heimenkyou | v1.0</text>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';

const barcodes = ref([]);

/**
 * 从本地存储加载条码数据
 */
const loadBarcodes = () => {
	const data = uni.getStorageSync('barcodes');
	barcodes.value = data || [];
};

/**
 * 保存条码数据到本地存储
 */
const saveBarcodes = () => {
	uni.setStorageSync('barcodes', barcodes.value);
};

/**
 * 添加条码
 */
const addBarcode = () => {
	uni.chooseImage({
		count: 1,
		sizeType: ['compressed'],
		sourceType: ['album', 'camera'],
		success: (res) => {
			console.log('选择图片成功:', res);
			const tempFilePath = res.tempFilePaths[0];
			
			// #ifdef APP-PLUS
			// APP环境：将文件保存到应用沙盒目录
			const savedFileName = Date.now() + '.jpg';
			
			plus.io.resolveLocalFileSystemURL('_doc', (entry) => {
				entry.getDirectory('barcodes', { create: true }, (dirEntry) => {
					console.log('目录创建成功');
					
					plus.io.resolveLocalFileSystemURL(tempFilePath, (fileEntry) => {
						fileEntry.copyTo(dirEntry, savedFileName, (newEntry) => {
							const finalPath = newEntry.toLocalURL();
							console.log('文件保存成功:', finalPath);
							
							const newBarcode = {
								id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
								name: '',
								imageData: finalPath
							};
							
							barcodes.value.push(newBarcode);
							saveBarcodes();
							console.log('条码已保存到storage:', barcodes.value);
							
							uni.showToast({
								title: '添加成功',
								icon: 'success'
							});
						}, (error) => {
							console.error('复制文件失败:', error);
							uni.showToast({
								title: '保存失败',
								icon: 'error'
							});
						});
					}, (error) => {
						console.error('解析源文件失败:', error);
					});
				}, (error) => {
					console.error('创建目录失败:', error);
				});
			}, (error) => {
				console.error('解析_doc失败:', error);
			});
			// #endif
			
			// #ifndef APP-PLUS
			// H5环境：转Base64（仅用于开发测试）
			// 注意：H5环境下uni.getFileSystemManager也可能不可用
			// 这里用简化方案：直接使用临时路径
			console.log('H5环境，使用临时路径');
			const newBarcode = {
				id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
				name: '',
				imageData: tempFilePath
			};
			
			barcodes.value.push(newBarcode);
			saveBarcodes();
			console.log('条码已保存到storage:', barcodes.value);
			
			uni.showToast({
				title: '添加成功',
				icon: 'success'
			});
			// #endif
		},
		fail: (err) => {
			console.error('选择图片失败:', err);
		}
	});
};

/**
 * 删除条码
 * @param {number} index - 条码在数组中的索引
 */
const deleteBarcode = (index) => {
	uni.showModal({
		title: '确认删除',
		content: '确定要删除这个条码吗？',
		success: (res) => {
			if (res.confirm) {
				barcodes.value.splice(index, 1);
				saveBarcodes();
				uni.showToast({
					title: '删除成功',
					icon: 'success'
				});
			}
		}
	});
};

onMounted(() => {
	loadBarcodes();
});

onShow(() => {
	// 每次显示时重新加载，以防从其他页面返回
	loadBarcodes();
});
</script>

<style scoped>
.content {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	background-color: #f5f5f5;
}

.header {
	padding: 30px 20px 20px;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: white;
}

.title {
	font-size: 28px;
	font-weight: bold;
	display: block;
	margin-bottom: 8px;
}

.subtitle {
	font-size: 14px;
	opacity: 0.9;
	display: block;
}

.barcode-list {
	flex: 1;
	padding: 15px;
}

.barcode-item {
	background: white;
	border-radius: 12px;
	padding: 15px;
	margin-bottom: 15px;
	display: flex;
	align-items: center;
	box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.barcode-image {
	width: 80px;
	height: 80px;
	min-width: 80px;
	min-height: 80px;
	max-width: 80px;
	max-height: 80px;
	border-radius: 8px;
	background-color: #f0f0f0;
	margin-right: 15px;
	flex-shrink: 0;
}

.barcode-info {
	flex: 1;
	min-width: 0;
	overflow: hidden;
}

.barcode-name {
	font-size: 16px;
	color: #333;
	font-weight: 500;
	word-break: break-all;
	display: block;
}

.barcode-actions {
	margin-left: 10px;
}

.btn-delete {
	background-color: #ff4444;
	color: white;
	border: none;
	border-radius: 6px;
	padding: 8px 16px;
	font-size: 14px;
}

.empty-state {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 60px 20px;
}

.empty-text {
	font-size: 48px;
	margin-bottom: 15px;
	display: block;
}

.empty-hint {
	font-size: 14px;
	color: #999;
	display: block;
}

.footer {
	padding: 20px;
	background: white;
}

.btn-add {
	width: 100%;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: white;
	border: none;
	border-radius: 8px;
	font-size: 16px;
	font-weight: 500;
	padding: 15px;
	margin-bottom: 20px;
}

.info-section {
	margin-bottom: 15px;
	padding: 15px;
	background-color: #f9f9f9;
	border-radius: 8px;
}

.info-title {
	font-size: 14px;
	font-weight: bold;
	color: #333;
	display: block;
	margin-bottom: 8px;
}

.info-text {
	font-size: 13px;
	color: #666;
	display: block;
	line-height: 1.8;
	margin-bottom: 4px;
}

.desc {
	font-size: 12px;
	color: #999;
	display: block;
	text-align: center;
}
</style>
