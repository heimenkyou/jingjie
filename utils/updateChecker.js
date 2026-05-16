import { APP_VERSION_CODE as CURRENT_VERSION_CODE, APP_VERSION_NAME as CURRENT_VERSION_NAME } from '@/utils/appVersion.js';

const UPDATE_URL = 'https://jingjie.luowb.cn/update.json';
const CHECK_INTERVAL = 60 * 1000;
const REQUEST_TIMEOUT = 3000;

const STORAGE_KEYS = {
	lastCheckAt: 'updateLastCheckAt',
	ignoredVersion: 'updateIgnoredVersion',
	downloadedVersion: 'updateDownloadedVersion',
	downloadedFilePath: 'updateDownloadedFilePath'
};

let isChecking = false;
let pendingForceUpdate = null;

let currentTargetVersion = Number(uni.getStorageSync(STORAGE_KEYS.downloadedVersion)) || 0;
let localFilePath = uni.getStorageSync(STORAGE_KEYS.downloadedFilePath) || null;
// 下载状态管理，如果在缓存里发现已经下载过新版本，恢复状态为 SUCCESS
let downloadState = (localFilePath && currentTargetVersion > CURRENT_VERSION_CODE) ? 'SUCCESS' : 'IDLE';
let currentDownloadTask = null;

const requestUpdateInfo = () => new Promise((resolve, reject) => {
	uni.request({
		url: UPDATE_URL,
		method: 'GET',
		timeout: REQUEST_TIMEOUT,
		success: (res) => {
			if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
				resolve(typeof res.data === 'string' ? JSON.parse(res.data) : res.data);
				return;
			}
			reject(new Error(`更新信息请求失败: ${res.statusCode}`));
		},
		fail: reject
	});
});

const shouldSkipSilentCheck = () => {
	const lastCheckAt = Number(uni.getStorageSync(STORAGE_KEYS.lastCheckAt) || 0);
	return Date.now() - lastCheckAt < CHECK_INTERVAL;
};

// #ifdef APP-PLUS
const reportDownload = () => {
	uni.request({
		url: 'https://webhook.luowb.cn/hooks/jingjie-download-inc',
		method: 'GET',
		fail: (err) => {
			console.warn('[净界-updateChecker] 下载量上报失败', err);
		}
	});
};

const promptDownloading = (info) => {
	let percent = 0;
	if (currentDownloadTask && currentDownloadTask.totalSize > 0) {
		percent = Math.floor((currentDownloadTask.downloadedSize / currentDownloadTask.totalSize) * 100);
	}
	const title = info.title || `新版本 ${info.versionName} 下载中`;
	const updateLog = [info.date, info.log].filter(Boolean).join('\n\n');
	
	// 原生 Modal 无法动态刷新按钮文字，所以静态展示进度，点击可关闭
	const content = `更新内容：\n${updateLog}\n\n正在后台下载...`;

	uni.showModal({
		title,
		content,
		confirmText: '转入后台',
		showCancel: false
	});
};

const installApk = (filePath) => {
	console.log(`[净界-updateChecker] 准备安装 APK: ${filePath}`);
	plus.runtime.install(
		filePath,
		{ force: false },
		() => {
			console.log('[净界-updateChecker] 安装触发成功');
			plus.runtime.quit();
		},
		(err) => {
			console.error('[净界-updateChecker] 安装失败', err);
			uni.showToast({ title: `安装失败，文件可能已损坏，请重新下载`, icon: 'none', duration: 3000 });
			
			// 安装失败，清空相关状态和缓存，使其可以重新下载
			downloadState = 'IDLE';
			localFilePath = null;
			uni.removeStorageSync(STORAGE_KEYS.downloadedVersion);
			uni.removeStorageSync(STORAGE_KEYS.downloadedFilePath);
		}
	);
};

const promptInstall = (info) => {
	const title = info.title || `新版本 ${info.versionName} 已准备就绪`;
	const updateLog = [info.date, info.log].filter(Boolean).join('\n\n');
	const content = `安装包已下载完成！\n\n更新内容：\n${updateLog}\n\n是否立即安装？`;

	uni.showModal({
		title,
		content,
		confirmText: '立即安装',
		cancelText: '稍后',
		showCancel: !info.force,
		success: (res) => {
			if (res.confirm) {
				installApk(localFilePath);
			} else {
				if (info.force) {
					// 强制更新不可跳过，缩小重弹延迟
					setTimeout(() => promptInstall(info), 0);
				} else {
					uni.setStorageSync(STORAGE_KEYS.ignoredVersion, info.versionCode);
				}
			}
		}
	});
};

const promptDownload = (info) => {
	const title = info.title || `发现新版本 ${info.versionName}`;
	const content = [info.date, info.log].filter(Boolean).join('\n\n');

	uni.showModal({
		title,
		content,
		confirmText: '开始下载',
		cancelText: '稍后',
		showCancel: !info.force,
		success: (res) => {
			if (res.confirm) {
				startDownload(info, false);
			} else {
				if (info.force) {
					// 强制更新不可跳过，缩小重弹延迟
					setTimeout(() => promptDownload(info), 0);
				} else {
					uni.setStorageSync(STORAGE_KEYS.ignoredVersion, info.versionCode);
				}
			}
		}
	});
};

const startDownload = (info, isSilent) => {
	if (downloadState === 'DOWNLOADING') {
		if (!isSilent) promptDownloading(info);
		return;
	}

	downloadState = 'DOWNLOADING';
	reportDownload();

	if (!isSilent) {
		uni.showToast({ title: '已开始在后台下载更新...', icon: 'none' });
	}

	console.log(`[净界-updateChecker] 开始${isSilent ? '静默' : ''}下载更新: ${info.url}`);
	currentDownloadTask = plus.downloader.createDownload(
		info.url,
		{ filename: '_downloads/update/' },
		(download, status) => {
			currentDownloadTask = null;

			if (status === 200) {
				console.log(`[净界-updateChecker] 下载成功, 保存路径: ${download.filename}`);
				downloadState = 'SUCCESS';
				localFilePath = download.filename;
				uni.setStorageSync(STORAGE_KEYS.downloadedVersion, currentTargetVersion);
				uni.setStorageSync(STORAGE_KEYS.downloadedFilePath, localFilePath);
				promptInstall(info);
			} else {
				console.warn(`[净界-updateChecker] 下载失败, HTTP状态码: ${status}`);
				downloadState = 'IDLE';
				localFilePath = null;
				if (!isSilent) {
					uni.showToast({ title: '下载失败，请重试', icon: 'none' });
				}
			}
		}
	);

	currentDownloadTask.addEventListener('statechanged', (task) => {
		// 之前原生等待框的进度回调这里不再需要去 setTitle 了
	});

	currentDownloadTask.start();
};
// #endif

export const checkForUpdate = async ({ silent = true, force = false } = {}) => {
	if (isChecking) return null;
	if (silent && !force && shouldSkipSilentCheck()) return null;

	isChecking = true;
	console.log(`[净界-updateChecker] 开始检查更新, silent: ${silent}, force: ${force}`);

	try {
		if (silent) {
			uni.setStorageSync(STORAGE_KEYS.lastCheckAt, Date.now());
		}

		const data = await requestUpdateInfo();
		uni.setStorageSync(STORAGE_KEYS.lastCheckAt, Date.now());

		const ignoredVersion = uni.getStorageSync(STORAGE_KEYS.ignoredVersion);

		if (data.versionCode > CURRENT_VERSION_CODE && (!silent || data.force || ignoredVersion !== data.versionCode)) {
			console.log(`[净界-updateChecker] 发现新版本信息: ${data.versionName} (code: ${data.versionCode}), 当前状态: ${downloadState}`);
			
			if (data.force) {
				pendingForceUpdate = data;
			}

			// 如果发现的版本和之前的不一样，需要重置状态
			if (currentTargetVersion !== data.versionCode) {
				console.log(`[净界-updateChecker] 发现新版本 ${data.versionCode}，重置之前版本 ${currentTargetVersion} 的状态`);
				downloadState = 'IDLE';
				localFilePath = null;
				uni.removeStorageSync(STORAGE_KEYS.downloadedVersion);
				uni.removeStorageSync(STORAGE_KEYS.downloadedFilePath);
				// #ifdef APP-PLUS
				if (currentDownloadTask) {
					currentDownloadTask.abort();
					currentDownloadTask = null;
				}
				// #endif
				currentTargetVersion = data.versionCode;
			}

			// #ifdef APP-PLUS
			if (silent) {
				if (downloadState === 'IDLE') {
					startDownload(data, true);
				} else if (downloadState === 'DOWNLOADING') {
					// 继续静默，不处理
				} else if (downloadState === 'SUCCESS') {
					promptInstall(data);
				}
			} else {
				if (downloadState === 'IDLE') {
					promptDownload(data);
				} else if (downloadState === 'DOWNLOADING') {
					promptDownloading(data);
				} else if (downloadState === 'SUCCESS') {
					promptInstall(data);
				}
			}
			// #endif

			// #ifdef H5
			if (!silent || data.force) {
				uni.showModal({
					title: `发现新版本 ${data.versionName}`,
					content: [data.date, data.log].filter(Boolean).join('\n\n'),
					confirmText: '去下载',
					showCancel: !data.force,
					success: (res) => {
						if (res.confirm) window.open(data.url, '_blank');
					}
				});
			}
			// #endif

			return data;
		}

		if (!silent) {
			uni.showToast({
				title: `已是最新版本 ${CURRENT_VERSION_NAME}`,
				icon: 'none'
			});
		}

		return data;
	} catch (error) {
		if (!silent) {
			uni.showToast({
				title: '检查失败，请稍后重试',
				icon: 'none'
			});
		}
		return null;
	} finally {
		isChecking = false;
	}
};

export const scheduleUpdateCheck = () => {
	setTimeout(() => {
		checkForUpdate({ silent: true });
	}, 3000);
};

export const showPendingForceUpdate = () => {
	if (pendingForceUpdate) {
		// #ifdef APP-PLUS
		if (downloadState === 'SUCCESS') {
			promptInstall(pendingForceUpdate);
		} else if (downloadState === 'DOWNLOADING') {
			promptDownloading(pendingForceUpdate);
		} else {
			promptDownload(pendingForceUpdate);
		}
		// #endif

		// #ifdef H5
		uni.showModal({
			title: `发现新版本 ${pendingForceUpdate.versionName}`,
			content: [pendingForceUpdate.date, pendingForceUpdate.log].filter(Boolean).join('\n\n'),
			confirmText: '去下载',
			showCancel: false,
			success: (res) => {
				if (res.confirm) window.open(pendingForceUpdate.url, '_blank');
			}
		});
		// #endif
	}
};
