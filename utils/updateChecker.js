import { APP_VERSION_CODE as CURRENT_VERSION_CODE, APP_VERSION_NAME as CURRENT_VERSION_NAME } from '@/utils/appVersion.js';
import { ref } from 'vue';

const UPDATE_URL = 'https://jingjie.luowb.cn/update.json';
const OFFICIAL_SITE_URL = 'https://jingjie.luowb.cn';
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
let isProgressDialogHidden = false;
export const updateDownloadProgress = ref({
	visible: false,
	percent: 0,
	downloadedSize: 0,
	totalSize: 0
});
export const updatePrompt = ref({
	visible: false,
	title: '',
	content: '',
	confirmText: '确定',
	cancelText: '取消',
	showCancel: true,
	onConfirm: null,
	onCancel: null
});

const showDownloadProgress = (percent, downloadedSize = 0, totalSize = 0) => {
	updateDownloadProgress.value = {
		visible: !isProgressDialogHidden,
		percent,
		downloadedSize,
		totalSize
	};
};

export const hideUpdateDownloadProgress = () => {
	isProgressDialogHidden = true;
	updateDownloadProgress.value = {
		...updateDownloadProgress.value,
		visible: false
	};
};

const showUpdatePrompt = (options) => {
	updatePrompt.value = {
		visible: true,
		...options
	};
};

export const resolveUpdatePrompt = (confirmed) => {
	const handler = confirmed ? updatePrompt.value.onConfirm : updatePrompt.value.onCancel;
	updatePrompt.value = {
		...updatePrompt.value,
		visible: false
	};
	handler?.();
};

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
		url: 'https://jingjie.luowb.cn/api/downloads',
		method: 'POST',
		fail: (err) => {
			console.warn('[净界-updateChecker] 下载量上报失败', err);
		}
	});
};

const getDownloadProgress = () => {
	if (!currentDownloadTask || currentDownloadTask.totalSize <= 0) return 0;
	return Math.min(100, Math.floor((currentDownloadTask.downloadedSize / currentDownloadTask.totalSize) * 100));
};

export const openOfficialDownloadPage = () => {
	// #ifdef APP-PLUS
	plus.runtime.openURL(OFFICIAL_SITE_URL);
	// #endif

	// #ifdef H5
	window.open(OFFICIAL_SITE_URL, '_blank');
	// #endif
};

const promptDownloadFailed = (info) => {
	showUpdatePrompt({
		title: '更新下载失败',
		content: '网络可能不稳定。你可以重试，或前往官网手动下载安装包覆盖安装。',
		confirmText: '官网下载',
		cancelText: '重新下载',
		showCancel: true,
		onConfirm: openOfficialDownloadPage,
		onCancel: () => startDownload(info, false, info.isTest)
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

	showUpdatePrompt({
		title,
		content,
		confirmText: '立即安装',
		cancelText: '稍后',
		showCancel: !info.force,
		onConfirm: () => installApk(localFilePath),
		onCancel: () => {
			if (info.isTest) {
				downloadState = 'IDLE';
				localFilePath = null;
				uni.removeStorageSync(STORAGE_KEYS.downloadedVersion);
				uni.removeStorageSync(STORAGE_KEYS.downloadedFilePath);
				return;
			}

			if (info.force) {
				setTimeout(() => promptInstall(info), 0);
			} else {
				uni.setStorageSync(STORAGE_KEYS.ignoredVersion, info.versionCode);
			}
		}
	});
};

const promptDownload = (info) => {
	const title = info.title || `发现新版本 ${info.versionName}`;
	const content = [info.date, info.log].filter(Boolean).join('\n\n');

	showUpdatePrompt({
		title,
		content,
		confirmText: '开始下载',
		cancelText: '稍后',
		showCancel: !info.force,
		onConfirm: () => startDownload(info, false, info.isTest),
		onCancel: () => {
			if (info.force) {
				setTimeout(() => promptDownload(info), 0);
			} else {
				uni.setStorageSync(STORAGE_KEYS.ignoredVersion, info.versionCode);
			}
		}
	});
};

const startDownload = (info, isSilent, isTest = false) => {
	if (downloadState === 'DOWNLOADING') {
		return;
	}

	downloadState = 'DOWNLOADING';
	if (!isTest) reportDownload();

	console.log(`[净界-updateChecker] 开始${isSilent ? '静默' : ''}下载更新: ${info.url}`);
	let lastProgress = -1;
	isProgressDialogHidden = false;
	showDownloadProgress(0);
	currentDownloadTask = plus.downloader.createDownload(
		info.url,
		{ filename: '_downloads/update/' },
		(download, status) => {
			currentDownloadTask = null;
			hideUpdateDownloadProgress();
			const contentType = typeof download.getResponseHeader === 'function'
				? (download.getResponseHeader('Content-Type') || '').toLowerCase()
				: '';
			const isApkResponse = !contentType || contentType.includes('android.package-archive') || contentType.includes('application/octet-stream') || contentType.includes('application/zip');

			if (status === 200 && isApkResponse) {
				console.log(`[净界-updateChecker] 下载成功, 保存路径: ${download.filename}`);
				downloadState = 'SUCCESS';
				localFilePath = download.filename;

				uni.setStorageSync(STORAGE_KEYS.downloadedVersion, currentTargetVersion);
				uni.setStorageSync(STORAGE_KEYS.downloadedFilePath, localFilePath);
				promptInstall(info);
			} else {
				console.warn(`[净界-updateChecker] 下载失败, HTTP状态码: ${status}, Content-Type: ${contentType}`);
				downloadState = 'IDLE';
				localFilePath = null;
				promptDownloadFailed(info);
			}
		}
	);

	currentDownloadTask.addEventListener('statechanged', (task) => {
		if (task.totalSize <= 0) {
			showDownloadProgress(0, task.downloadedSize, 0);
			return;
		}

		const percent = Math.min(100, Math.floor((task.downloadedSize / task.totalSize) * 100));
		if (percent === lastProgress) return;

		lastProgress = percent;
		showDownloadProgress(percent, task.downloadedSize, task.totalSize);
	});

	currentDownloadTask.start();
};
// #endif

export const checkForUpdate = async ({ silent = true, force = false, test = false } = {}) => {
	if (isChecking) return null;
	if (silent && !force && shouldSkipSilentCheck()) return null;

	isChecking = true;
	console.log(`[净界-updateChecker] 开始检查更新, silent: ${silent}, force: ${force}`);

	try {
		if (silent) {
			uni.setStorageSync(STORAGE_KEYS.lastCheckAt, Date.now());
		}

		let data = await requestUpdateInfo();
		if (test) {
			data = {
				...data,
				versionCode: CURRENT_VERSION_CODE + 1,
				versionName: `${data.versionName}（测试）`,
				force: false,
				isTest: true
			};
		}
		uni.setStorageSync(STORAGE_KEYS.lastCheckAt, Date.now());

		const ignoredVersion = uni.getStorageSync(STORAGE_KEYS.ignoredVersion);

		if ((data.versionCode > CURRENT_VERSION_CODE || test) && (!silent || data.force || ignoredVersion !== data.versionCode)) {
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
					startDownload(data, true, data.isTest);
				} else if (downloadState === 'DOWNLOADING') {
					// 继续静默，不处理
				} else if (downloadState === 'SUCCESS') {
					promptInstall(data);
				}
			} else {
				if (downloadState === 'IDLE') {
					promptDownload(data);
				} else if (downloadState === 'DOWNLOADING') {
					showDownloadProgress(getDownloadProgress());
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

/**
 * 模拟高版本更新，复用完整更新流程进行调试。
 */
export const testUpdateDownload = async () => {
	await checkForUpdate({ silent: false, force: true, test: true });
};

export const showPendingForceUpdate = () => {
	if (pendingForceUpdate) {
		// #ifdef APP-PLUS
		if (downloadState === 'SUCCESS') {
			promptInstall(pendingForceUpdate);
		} else if (downloadState === 'DOWNLOADING') {
			showDownloadProgress(getDownloadProgress());
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
