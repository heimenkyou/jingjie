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
