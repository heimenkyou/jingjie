import { APP_VERSION_CODE as CURRENT_VERSION_CODE, APP_VERSION_NAME as CURRENT_VERSION_NAME } from '@/utils/appVersion.js';
import { ref } from 'vue';
import { ANALYTICS_EVENTS, track } from '@/utils/analytics.js';
import { showModal, showToast } from '@/utils/feedback.js';

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

/**
 * 清除已下载安装包的状态，重新进入下载流程。
 */
const resetDownloadedState = () => {
	downloadState = 'IDLE';
	localFilePath = null;
	uni.removeStorageSync(STORAGE_KEYS.downloadedVersion);
	uni.removeStorageSync(STORAGE_KEYS.downloadedFilePath);
};

/**
 * 校验缓存的安装包文件是否仍存在。
 * @param {string | null} filePath 安装包路径
 * @returns {Promise<boolean>}
 */
const isDownloadedFileAvailable = (filePath) => new Promise((resolve) => {
	if (!filePath) {
		resolve(false);
		return;
	}

	// #ifdef APP-PLUS
	plus.io.resolveLocalFileSystemURL(filePath, () => resolve(true), () => resolve(false));
	// #endif

	// #ifndef APP-PLUS
	resolve(false);
	// #endif
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

/**
 * 解析并校验更新信息，避免异常响应阻塞后续检查。
 * @param {unknown} payload 更新接口响应
 * @returns {{versionCode: number, versionName: string, url: string}}
 */
const parseUpdateInfo = (payload) => {
	let data = payload;
	if (typeof payload === 'string') {
		try {
			data = JSON.parse(payload);
		} catch {
			throw new Error('更新信息格式无效');
		}
	}

	const versionCode = Number(data?.versionCode);
	if (!Number.isInteger(versionCode) || versionCode <= 0 || !data?.versionName?.trim() || !data?.url?.trim()) {
		throw new Error('更新信息字段无效');
	}

	return {
		...data,
		versionCode
	};
};

const requestUpdateInfo = () => new Promise((resolve, reject) => {
	uni.request({
		url: UPDATE_URL,
		method: 'GET',
		timeout: REQUEST_TIMEOUT,
		success: (res) => {
			if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
				try {
					resolve(parseUpdateInfo(res.data));
				} catch (error) {
					reject(error);
				}
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
			track(ANALYTICS_EVENTS.updateInstall);
			plus.runtime.quit();
		},
		(err) => {
			console.error('[净界-updateChecker] 安装失败', err);
			showToast({ title: `安装失败，文件可能已损坏，请重新下载`, icon: 'none', duration: 3000 });
			resetDownloadedState();
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
		onConfirm: async () => {
			if (await isDownloadedFileAvailable(localFilePath)) {
				installApk(localFilePath);
				return;
			}

			resetDownloadedState();
			startDownload(info, false, info.isTest);
		},
		onCancel: () => {
			if (info.isTest) {
				resetDownloadedState();
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

	console.log(`[净界-updateChecker] 开始${isSilent ? '静默' : ''}下载更新: ${info.url}`);
	let lastProgress = -1;
	isProgressDialogHidden = false;
	showDownloadProgress(0);
	const targetVersion = info.versionCode;
	const downloadTask = plus.downloader.createDownload(
		info.url,
		{ filename: '_downloads/update/' },
		(download, status) => {
			if (currentDownloadTask !== downloadTask || currentTargetVersion !== targetVersion) return;

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
				if (!isTest) {
					reportDownload();
					track(ANALYTICS_EVENTS.updateDownload, { source: 'inapp' });
				}
				promptInstall(info);
			} else {
				console.warn(`[净界-updateChecker] 下载失败, HTTP状态码: ${status}, Content-Type: ${contentType}`);
				downloadState = 'IDLE';
				localFilePath = null;
				promptDownloadFailed(info);
			}
		}
	);
	currentDownloadTask = downloadTask;

	downloadTask.addEventListener('statechanged', (task) => {
		if (currentDownloadTask !== downloadTask || currentTargetVersion !== targetVersion) return;
		if (task.totalSize <= 0) {
			showDownloadProgress(0, task.downloadedSize, 0);
			return;
		}

		const percent = Math.min(100, Math.floor((task.downloadedSize / task.totalSize) * 100));
		if (percent === lastProgress) return;

		lastProgress = percent;
		showDownloadProgress(percent, task.downloadedSize, task.totalSize);
	});

	downloadTask.start();
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
				resetDownloadedState();
				// #ifdef APP-PLUS
				if (currentDownloadTask) {
					currentDownloadTask.abort();
					currentDownloadTask = null;
				}
				// #endif
				currentTargetVersion = data.versionCode;
			}

			if (downloadState === 'SUCCESS' && !(await isDownloadedFileAvailable(localFilePath))) {
				resetDownloadedState();
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
				const result = await showModal({
					title: `发现新版本 ${data.versionName}`,
					content: [data.date, data.log].filter(Boolean).join('\n\n'),
					confirmText: '去下载',
					showCancel: !data.force
				});
				if (result.confirm) window.open(data.url, '_blank');
			}
			// #endif

			return data;
		}

		if (!silent) {
			showToast({
				title: `已是最新版本 ${CURRENT_VERSION_NAME}`,
				icon: 'none'
			});
		}

		return data;
	} catch (error) {
		if (!silent) {
			showToast({
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

export const showPendingForceUpdate = async () => {
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
		const result = await showModal({
			title: `发现新版本 ${pendingForceUpdate.versionName}`,
			content: [pendingForceUpdate.date, pendingForceUpdate.log].filter(Boolean).join('\n\n'),
			confirmText: '去下载',
			showCancel: false
		});
		if (result.confirm) window.open(pendingForceUpdate.url, '_blank');
		// #endif
	}
};
