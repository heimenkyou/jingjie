import { STATION_LOG_PREFIX } from '@/utils/stationLog.js';

/**
 * 将当前 Android WebView 的 Cookie 及时落盘，减少前后台切换时的状态丢失。
 */
export const flushWebviewCookies = () => {
	// #ifdef APP-PLUS
	if (typeof plus === 'undefined' || plus.os?.name !== 'Android') return;

	try {
		const CookieManager = plus.android.importClass('android.webkit.CookieManager');
		const cookieManager = CookieManager.getInstance();
		plus.android.importClass(cookieManager);
		console.log(STATION_LOG_PREFIX, '同步 WebView Cookie');
		cookieManager.flush();
	} catch (error) {
		console.warn(STATION_LOG_PREFIX, '同步 WebView Cookie 失败:', error);
	}
	// #endif
};

/**
 * 清理 WebView 站点数据与登录态，作为驿站页异常时的保底恢复手段。
 */
export const clearWebviewSiteData = () => {
	// #ifdef APP-PLUS
	if (typeof plus === 'undefined' || plus.os?.name !== 'Android') return;

	try {
		const CookieManager = plus.android.importClass('android.webkit.CookieManager');
		const cookieManager = CookieManager.getInstance();
		plus.android.importClass(cookieManager);

		if (typeof cookieManager.removeAllCookies === 'function') {
			cookieManager.removeAllCookies(null);
		} else if (typeof cookieManager.removeAllCookie === 'function') {
			cookieManager.removeAllCookie();
		}

		if (typeof cookieManager.removeSessionCookies === 'function') {
			cookieManager.removeSessionCookies(null);
		} else if (typeof cookieManager.removeSessionCookie === 'function') {
			cookieManager.removeSessionCookie();
		}

		if (typeof cookieManager.flush === 'function') {
			cookieManager.flush();
		}

		const WebStorage = plus.android.importClass('android.webkit.WebStorage');
		const webStorage = WebStorage.getInstance();
		plus.android.importClass(webStorage);
		webStorage.deleteAllData();

		console.log(STATION_LOG_PREFIX, '已清理 WebView 站点数据与 Cookie');
	} catch (error) {
		console.warn(STATION_LOG_PREFIX, '清理 WebView 站点数据失败:', error);
	}
	// #endif
};
