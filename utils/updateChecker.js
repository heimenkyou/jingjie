import { APP_VERSION_CODE as CURRENT_VERSION_CODE, APP_VERSION_NAME as CURRENT_VERSION_NAME } from '@/utils/appVersion.js';

const UPDATE_URL = 'https://jingjie.luowb.cn/update.json';
const CHECK_INTERVAL = 60 * 1000;
const REQUEST_TIMEOUT = 3000;

const STORAGE_KEYS = {
	lastCheckAt: 'updateLastCheckAt',
	ignoredVersion: 'updateIgnoredVersion'
};

let isChecking = false;
let isDownloading = false;
let pendingForceUpdate = null;
let isUpdateDialogVisible = false;

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
/**
 * 异步上报一次下载事件，失败只记日志，不阻塞主流程。
 */
const reportDownload = () => {
	uni.request({
		url: 'https://webhook.luowb.cn/hooks/jingjie-download-inc',
		method: 'GET',
		fail: (err) => {
			console.warn('[updateChecker] 下载量上报失败', err);
		}
	});
};

/**
 * 静默后台下载 APK，resolve 本地文件路径，下载失败 resolve null（降级处理）。
 * 使用 plus.downloader 以正确跟随 302 重定向。
 */
const silentDownloadApk = (url) => new Promise((resolve) => {
	if (isDownloading) {
		resolve(null);
		return;
	}
	isDownloading = true;

	// 下载开始时上报，统计用户实际触发下载的次数
	reportDownload();

	const task = plus.downloader.createDownload(
		url,
		{ filename: '_downloads/update.apk' },
		(download, status) => {
			isDownloading = false;
			resolve(status === 200 ? download.filename : null);
		}
	);

	task.start();
});
// #endif

/**
 * 展示更新弹窗。
 * @param {object} info - 服务端返回的更新信息
 * @param {string|null} localFilePath - 已下载的 APK 本地路径；为 null 时降级跳浏览器
 */
const showUpdateDialog = (info, localFilePath = null) => {
	if (isUpdateDialogVisible) return;

	const title = info.title || `发现新版本 ${info.versionName}`;
	const content = [info.date, info.log].filter(Boolean).join('\n\n');

	// 已有本地包则直接安装，否则降级到浏览器下载
	const confirmText = localFilePath ? '立即安装' : '去下载';

	isUpdateDialogVisible = true;

	uni.showModal({
		title,
		content,
		confirmText,
		cancelText: '稍后',
		showCancel: !info.force,
		success: (res) => {
			if (res.confirm) {
				// #ifdef APP-PLUS
				if (localFilePath) {
					plus.runtime.install(
						localFilePath,
						{ force: false },
						() => plus.runtime.quit(),
						(err) => uni.showToast({ title: `安装失败: ${err.message}`, icon: 'none' })
					);
					return;
				}
				plus.runtime.openURL(info.url);
				// #endif

				// #ifdef H5
				window.open(info.url, '_blank');
				// #endif
				return;
			}

			uni.setStorageSync(STORAGE_KEYS.ignoredVersion, info.versionCode);
		},
		complete: () => {
			isUpdateDialogVisible = false;

			if (info.force) {
				setTimeout(() => {
					showUpdateDialog(info, localFilePath);
				}, 1000);
			}
		}
	});
};

export const checkForUpdate = async ({ silent = true, force = false } = {}) => {
	if (isChecking) return null;
	if (silent && !force && shouldSkipSilentCheck()) return null;

	isChecking = true;

	try {
		if (silent) {
			uni.setStorageSync(STORAGE_KEYS.lastCheckAt, Date.now());
		}

		const data = await requestUpdateInfo();
		uni.setStorageSync(STORAGE_KEYS.lastCheckAt, Date.now());

		const ignoredVersion = uni.getStorageSync(STORAGE_KEYS.ignoredVersion);

		if (data.versionCode > CURRENT_VERSION_CODE && (!silent || data.force || ignoredVersion !== data.versionCode)) {
			if (data.force) {
				pendingForceUpdate = data;
			}

			// #ifdef APP-PLUS
			// 先静默下载，完成后再弹提示，用户无需等待
			const localFilePath = await silentDownloadApk(data.url);
			showUpdateDialog(data, localFilePath);
			// #endif

			// #ifdef H5
			showUpdateDialog(data);
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
		showUpdateDialog(pendingForceUpdate);
	}
};
