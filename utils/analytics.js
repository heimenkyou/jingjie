import { APP_VERSION_NAME } from '@/utils/appVersion.js';

const TRACK_URL = 'https://jingjie.luowb.cn/api/jingjie-track';
const REQUEST_TIMEOUT = 3000;
const STORAGE_KEY = 'analyticsInstallId';

export const ANALYTICS_EVENTS = Object.freeze({
	appLaunch: 'app_launch',
	pageShow: 'page_show',
	barcodeAdd: 'barcode_add',
	stationOpenIdentityCode: 'station_open_identity_code',
	stationOpenHome: 'station_open_home',
	feedbackSubmit: 'feedback_submit',
	appError: 'app_error',
	updateDownload: 'update_download',
	updateInstall: 'update_install'
});

let sessionId = '';

const createId = () => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
		const value = Math.floor(Math.random() * 16);
		const digit = character === 'x' ? value : (value & 0x3) | 0x8;
		return digit.toString(16);
	});
};

const getInstallId = () => {
	let installId = uni.getStorageSync(STORAGE_KEY);
	if (installId) return installId;

	installId = createId();
	uni.setStorageSync(STORAGE_KEY, installId);
	return installId;
};

const getPlatform = () => {
	try {
		return uni.getSystemInfoSync().platform || 'unknown';
	} catch {
		return 'unknown';
	}
};

/**
 * 初始化本次应用启动的统计上下文。
 */
export const initAnalytics = () => {
	getInstallId();
	sessionId = createId();
};

/**
 * 异步上报一个白名单内的统计事件，不影响业务流程。
 * @param {string} event 事件名称
 * @param {Record<string, unknown>} [properties={}] 事件附加属性
 */
export const track = (event, properties = {}) => {
	if (!Object.values(ANALYTICS_EVENTS).includes(event)) return;
	if (!sessionId) initAnalytics();

	uni.request({
		url: TRACK_URL,
		method: 'POST',
		timeout: REQUEST_TIMEOUT,
		header: {
			'Content-Type': 'application/json'
		},
		data: {
			event,
			installId: getInstallId(),
			sessionId,
			appVersion: APP_VERSION_NAME,
			platform: getPlatform(),
			timestamp: Date.now(),
			properties
		}
	});
};

/**
 * 上报页面展示事件，用于计算页面 PV 与 UV。
 * @param {string} page 页面路径
 */
export const trackPage = (page) => {
	track(ANALYTICS_EVENTS.pageShow, { page });
};
