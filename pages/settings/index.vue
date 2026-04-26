<template>
	<view class="content">
		<view class="header">
			<text class="title">设置管理</text>
			<text class="subtitle">下方有使用说明</text>
		</view>

		<view class="settings-body">
			<view class="preference-section">
				<text class="preference-title">启动首选项</text>
				<view
					class="preference-option"
					v-for="item in startupOptions"
					:key="item.value"
					@click="setStartupTab(item.value)"
				>
					<view class="option-radio" :class="{ 'option-radio-selected': startupTab === item.value }">
						<view class="option-radio-dot" v-if="startupTab === item.value"></view>
					</view>
					<view class="option-content">
						<text class="option-label">{{ item.label }}</text>
						<text class="option-desc">{{ item.desc }}</text>
					</view>
				</view>
			</view>

			<view class="feature-section">
				<view class="section-heading">
					<text class="section-title">本地条码</text>
					<text class="section-desc">管理喝水和吹风机条码，默认项会优先展示</text>
				</view>

				<button class="btn-add" type="primary" @click="addBarcode">+ 添加条码</button>

				<text class="subsection-title" v-if="barcodes.length > 0">条码默认展示项</text>

				<view class="barcode-list" v-if="barcodes.length > 0">
					<view class="barcode-item" v-for="(item, index) in barcodes" :key="item.id">
						<view class="image-wrapper">
							<image class="barcode-image" :src="item.imageData" mode="aspectFit"></image>
							<view class="radio-wrapper" @click="setDefaultBarcode(item.id)">
								<view class="radio-circle" :class="{ 'radio-selected': defaultBarcodeId === item.id }">
									<view class="radio-dot" v-if="defaultBarcodeId === item.id"></view>
								</view>
							</view>
						</view>
						<view class="barcode-info" @click="renameBarcode(index)">
							<text class="barcode-name">{{ item.name || '条码 ' + (index + 1) }}</text>
							<text>{{ defaultBarcodeId === item.id ? '点击编辑名称\n✨ 默认开屏' : '点击编辑名称' }}</text>
						</view>
						<view class="barcode-actions">
							<button class="btn-delete" @click="deleteBarcode(index)">删除</button>
						</view>
					</view>
				</view>

				<view class="empty-state" v-else>
					<text class="empty-text">📷 暂无条码</text>
					<text class="empty-hint">点击上方按钮添加您的第一个条码</text>
				</view>
			</view>

			<view class="feature-section">
				<view class="section-heading">
					<text class="section-title">快递驿站</text>
					<text class="section-desc">选择进入驿站 Tab 后优先打开的网页</text>
				</view>
				<view
					class="preference-option"
					v-for="item in stationDefaultOptions"
					:key="item.value"
					@click="setStationDefaultPage(item.value)"
				>
					<view class="option-radio" :class="{ 'option-radio-selected': stationDefaultPage === item.value }">
						<view class="option-radio-dot" v-if="stationDefaultPage === item.value"></view>
					</view>
					<view class="option-content">
						<text class="option-label">{{ item.label }}</text>
						<text class="option-desc">{{ item.desc }}</text>
					</view>
				</view>
			</view>

			<view class="info-section">
				<text class="info-title">使用说明</text>
				<text class="info-text">1. 传截图：把饮水机/吹风机条码存进来，主页左右滑</text>
				<text class="info-text">2. 取快递：登录一次淘宝，以后点开直接出取件码。</text>
				<text class="info-text">3. 设默认：常用哪个，就把它设为“启动首选”。</text>
				<text class="info-text">4. 自动亮：进页面自动最亮，扫完切出自动恢复。</text>
			</view>

			<!-- 关于本项目 -->
			<view class="about-section">
				<text class="about-title">关于项目</text>

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
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';

const barcodes = ref([]);
const defaultBarcodeId = ref('');
const startupTab = ref('barcode');
const stationDefaultPage = ref('identity');

const startupOptions = [
	{
		value: 'barcode',
		label: '本地条码',
		desc: '打开应用后优先进入喝水/吹风机条码'
	},
	{
		value: 'station',
		label: '快递驿站',
		desc: '打开应用后优先进入驿站页面'
	}
];

const stationDefaultOptions = [
	{
		value: 'identity',
		label: '淘宝身份码',
		desc: '取快递出库'
	},
	{
		value: 'home',
		label: '校园驿站首页',
		desc: '查看待取快递和取件码'
	},
	{
		value: 'cainiao',
		label: '菜鸟出库码',
		desc: '可作为备用入口'
	}
];

const contactLinks = {
	qq: 'https://qm.qq.com/q/Hr6wc28uCO',
	email: 'mailto:wenbin.lo@outlook.com'
};

const wechatId = 'heimenkyou';

/**
 * 从本地存储加载条码数据
 */
const loadBarcodes = () => {
	const data = uni.getStorageSync('barcodes');
	barcodes.value = data || [];
	// 加载默认条码ID
	defaultBarcodeId.value = uni.getStorageSync('defaultBarcodeId') || '';
	// 如果默认条码ID不存在或不在列表中，自动设置第一个为默认
	if (barcodes.value.length > 0 && (!defaultBarcodeId.value || !barcodes.value.find(b => b.id === defaultBarcodeId.value))) {
		defaultBarcodeId.value = barcodes.value[0].id;
		uni.setStorageSync('defaultBarcodeId', defaultBarcodeId.value);
	}
};

/**
 * 保存条码数据到本地存储
 */
const saveBarcodes = () => {
	uni.setStorageSync('barcodes', barcodes.value);
};

const loadPreferences = () => {
	startupTab.value = uni.getStorageSync('startupTab') || 'barcode';
	stationDefaultPage.value = uni.getStorageSync('stationDefaultPage') || 'identity';
};

const setStartupTab = (value) => {
	startupTab.value = value;
	uni.setStorageSync('startupTab', value);
	uni.showToast({
		title: '启动项已更新',
		icon: 'success',
		duration: 1200
	});
};

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
 * 设置默认条码
 * @param {string} barcodeId - 条码ID
 */
const setDefaultBarcode = (barcodeId) => {
	defaultBarcodeId.value = barcodeId;
	uni.setStorageSync('defaultBarcodeId', barcodeId);
	uni.showToast({
		title: '已设为默认',
		icon: 'success',
		duration: 1500
	});
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
							// 如果是第一个条码，自动设为默认
							if (barcodes.value.length === 1) {
								defaultBarcodeId.value = newBarcode.id;
								uni.setStorageSync('defaultBarcodeId', newBarcode.id);
							}
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
			// 如果是第一个条码，自动设为默认
			if (barcodes.value.length === 1) {
				defaultBarcodeId.value = newBarcode.id;
				uni.setStorageSync('defaultBarcodeId', newBarcode.id);
			}
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
				const deletedId = barcodes.value[index].id;
				barcodes.value.splice(index, 1);
				// 如果删除的是默认条码，重新设置默认条码
				if (deletedId === defaultBarcodeId.value) {
					if (barcodes.value.length > 0) {
						defaultBarcodeId.value = barcodes.value[0].id;
						uni.setStorageSync('defaultBarcodeId', defaultBarcodeId.value);
					} else {
						defaultBarcodeId.value = '';
						uni.removeStorageSync('defaultBarcodeId');
					}
				}
				saveBarcodes();
				uni.showToast({
					title: '删除成功',
					icon: 'success'
				});
			}
		}
	});
};

/**
 * 重命名条码
 * @param {number} index - 条码在数组中的索引
 */
const renameBarcode = (index) => {
	uni.showModal({
		title: '修改名称',
		content: '请输入新名称',
		editable: true,
		placeholderText: barcodes.value[index].name || '条码 ' + (index + 1),
		success: (res) => {
			if (res.confirm && res.content) {
				barcodes.value[index].name = res.content.trim();
				saveBarcodes();
				console.log('条码名称已修改:', barcodes.value[index]);
				uni.showToast({
					title: '修改成功',
					icon: 'success'
				});
			}
		}
	});
};

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
 * 打开源码链接
 * @param {string} platform - 平台类型 ('github' 或 'gitee')
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
	// 每次显示时重新加载，以防从其他页面返回
	loadBarcodes();
	loadPreferences();
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
	background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
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

.settings-body {
	padding: 15px;
}

.barcode-list {
	padding: 0;
}

.barcode-item {
	background: white;
	border-radius: 12px;
	padding: 15px;
	margin-bottom: 15px;
	display: flex;
	align-items: center;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
	flex-shrink: 0;
}

.image-wrapper {
	position: relative;
	margin-right: 15px;
}

/* 单选框包装器 */
.radio-wrapper {
	position: absolute;
	top: -6px;
	left: -6px;
	padding: 6px;
	z-index: 10;
}

.radio-circle {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	border: 2px solid #d1d5db;
	background-color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.2s ease;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.radio-selected {
	border-color: #10b981;
	background-color: #10b981;
}

.radio-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background-color: #fff;
}

.barcode-info {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	cursor: pointer;
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
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 28px 20px 18px;
	background: #fff;
	border-radius: 8px;
}

.empty-text {
	font-size: 32px;
	margin-bottom: 10px;
	display: block;
}

.empty-hint {
	font-size: 14px;
	color: #999;
	display: block;
}

.btn-add {
	width: 100%;
	background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
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

.preference-section {
	margin-bottom: 15px;
	padding: 15px;
	background-color: #fff;
	border-radius: 8px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.preference-title {
	font-size: 14px;
	font-weight: bold;
	color: #333;
	display: block;
	margin-bottom: 10px;
}

.preference-option {
	display: flex;
	align-items: center;
	padding: 10px 0;
}

.preference-option + .preference-option {
	border-top: 1px solid #eee;
}

.option-radio {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	border: 2px solid #d1d5db;
	background-color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 12px;
	flex-shrink: 0;
}

.option-radio-selected {
	border-color: #10b981;
	background-color: #10b981;
}

.option-radio-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background-color: #fff;
}

.option-content {
	flex: 1;
	min-width: 0;
}

.option-label {
	font-size: 15px;
	color: #333;
	font-weight: 500;
	display: block;
	margin-bottom: 4px;
}

.option-desc {
	font-size: 12px;
	color: #888;
	line-height: 1.4;
	display: block;
}

.feature-section {
	margin-bottom: 15px;
	padding: 15px;
	background: #fff;
	border-radius: 8px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-heading {
	margin-bottom: 14px;
}

.section-title {
	font-size: 18px;
	font-weight: bold;
	color: #111827;
	display: block;
	margin-bottom: 5px;
}

.section-desc {
	font-size: 12px;
	color: #888;
	line-height: 1.5;
	display: block;
}

.subsection-title {
	font-size: 13px;
	font-weight: 600;
	color: #10b981;
	display: block;
	margin: 2px 0 10px;
}

/* 关于本项目 */
.about-section {
	background: rgba(255, 255, 255, 0.6);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
	border-radius: 12px;
	padding: 20px;
	margin-bottom: 15px;
	border: 1px solid rgba(16, 185, 129, 0.1);
}

.about-title {
	font-size: 18px;
	font-weight: bold;
	color: #10b981;
	display: block;
	margin-bottom: 16px;
	text-align: center;
}

.about-block {
	margin-bottom: 14px;
}

.about-subtitle {
	font-size: 15px;
	font-weight: 600;
	color: #333;
	display: block;
	margin-bottom: 8px;
}

.about-label {
	font-size: 14px;
	font-weight: 600;
	color: #10b981;
	display: block;
	margin-bottom: 6px;
}

.about-text {
	font-size: 13px;
	color: #666;
	line-height: 1.7;
	display: block;
}

.divider {
	height: 1px;
	background: linear-gradient(to right, transparent, rgba(16, 185, 129, 0.3), transparent);
	margin: 20px 0;
}

.author-section {
	margin-bottom: 16px;
	text-align: center;
}

.author-title {
	font-size: 15px;
	font-weight: 600;
	color: #333;
	display: block;
	margin-bottom: 10px;
}

.author-collab {
	font-size: 14px;
	color: #10b981;
	font-weight: 500;
	display: block;
	margin-bottom: 8px;
}

.author-quote {
	font-size: 12px;
	color: #999;
	font-style: italic;
	display: block;
	line-height: 1.6;
}

.contact-section {
	background: rgba(16, 185, 129, 0.05);
	border-radius: 8px;
	padding: 12px;
	text-align: center;
}

.contact-title {
	font-size: 14px;
	font-weight: 600;
	color: #333;
	display: block;
	margin-bottom: 8px;
}

.contact-item {
	font-size: 13px;
	color: #666;
	display: block;
	line-height: 1.8;
}

.contact-link {
	color: #10b981;
}

/* 源码地址板块 */
.source-section {
	background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%);
	border-radius: 8px;
	padding: 12px;
	margin-top: 12px;
}

.source-title {
	font-size: 14px;
	font-weight: 600;
	color: #333;
	display: block;
	margin-bottom: 6px;
	text-align: center;
}

.source-hint {
	font-size: 12px;
	color: #999;
	display: block;
	text-align: center;
	margin-bottom: 12px;
}

.source-links {
	display: flex;
	justify-content: center;
	gap: 12px;
}

.source-link {
	flex: 1;
	max-width: 120px;
	background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
	border-radius: 8px;
	padding: 10px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
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
