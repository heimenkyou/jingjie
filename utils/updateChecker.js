const UPDATE_URL = 'https://jingjie.luowb.cn/update.json';
const CURRENT_VERSION_NAME = 'v2.0.0';
const CURRENT_VERSION_CODE = 200;
const CHECK_INTERVAL = 60 * 1000;
const REQUEST_TIMEOUT = 3000;

const STORAGE_KEYS = {
	lastCheckAt: 'updateLastCheckAt',
	ignoredVersion: 'updateIgnoredVersion'
};

let isChecking = false;
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

const openDownloadUrl = (url) => {
	if (!url) return;

	// #ifdef APP-PLUS
	plus.runtime.openURL(url);
	// #endif

	// #ifdef H5
	window.open(url, '_blank');
	// #endif
};

const showUpdateDialog = (info) => {
	if (isUpdateDialogVisible) return;

	const title = info.title || `发现新版本 ${info.versionName}`;
	const content = [info.date, info.log].filter(Boolean).join('\n\n');

	isUpdateDialogVisible = true;

	uni.showModal({
		title,
		content,
		confirmText: '去下载',
		cancelText: '稍后',
		showCancel: !info.force,
		success: (res) => {
			if (res.confirm) {
				openDownloadUrl(info.url);
				return;
			}

			uni.setStorageSync(STORAGE_KEYS.ignoredVersion, info.versionCode);
		},
		complete: () => {
			isUpdateDialogVisible = false;

			if (info.force) {
				setTimeout(() => {
					showUpdateDialog(info);
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
			showUpdateDialog(data);
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
