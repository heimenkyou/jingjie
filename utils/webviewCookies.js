export const flushWebviewCookies = () => {
	// #ifdef APP-PLUS
	if (typeof plus === 'undefined' || plus.os?.name !== 'Android') return;

	try {
		const CookieManager = plus.android.importClass('android.webkit.CookieManager');
		const cookieManager = CookieManager.getInstance();
		plus.android.importClass(cookieManager);
		console.log('同步 WebView Cookie');
		cookieManager.flush();
	} catch (error) {
		console.warn('同步 WebView Cookie 失败:', error);
	}
	// #endif
};

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

		console.log('已清理 WebView 站点数据与 Cookie');
	} catch (error) {
		console.warn('清理 WebView 站点数据失败:', error);
	}
	// #endif
};
