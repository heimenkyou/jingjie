const STORAGE_KEY = 'stationAutoOpenTarget';

export const STATION_TARGETS = {
	identity: {
		key: 'identity',
		label: '淘宝身份码',
		url: 'taobao://m.taobao.com/tbopen/index.html?h5Url=https://market.m.taobao.com/app/cn-yz/multi-activity/authCode.html'
	},
	home: {
		key: 'home',
		label: '我的驿站',
		url: 'taobao://m.taobao.com/tbopen/index.html?h5Url=https://pages-fast.m.taobao.com/wow/z/uniapp/1100333/last-mile-fe/m-end-school-tab/home'
	}
};

/**
 * 读取进入驿站页时自动打开的目标。
 * @returns {string}
 */
export const getStationAutoOpenTarget = () => {
	const target = uni.getStorageSync(STORAGE_KEY);
	return STATION_TARGETS[target] ? target : '';
};

/**
 * 保存进入驿站页时自动打开的目标。
 * @param {string} target 驿站目标标识，空字符串表示关闭
 */
export const setStationAutoOpenTarget = (target) => {
	uni.setStorageSync(STORAGE_KEY, STATION_TARGETS[target] ? target : '');
};

/**
 * 请求将身份码固定到 Android 桌面。
 * @returns {{success: boolean, reason?: string}} 请求结果
 */
export const requestIdentityShortcut = () => {
	// #ifdef APP-PLUS
	if (typeof plus === 'undefined' || !plus.android) return { success: false, reason: 'notApp' };

	try {
		const activity = plus.android.runtimeMainActivity();
		const BuildVersion = plus.android.importClass('android.os.Build$VERSION');
		if (BuildVersion.SDK_INT < 26) return { success: false, reason: 'version' };

		const Intent = plus.android.importClass('android.content.Intent');
		const Uri = plus.android.importClass('android.net.Uri');
		const Icon = plus.android.importClass('android.graphics.drawable.Icon');
		const ShortcutInfoBuilder = plus.android.importClass('android.content.pm.ShortcutInfo$Builder');
		const shortcutManager = activity.getSystemService('shortcut');
		if (!shortcutManager) {
			return { success: false, reason: 'launcher' };
		}
		plus.android.importClass(shortcutManager);
		if (typeof shortcutManager.isRequestPinShortcutSupported !== 'function' || !shortcutManager.isRequestPinShortcutSupported()) {
			return { success: false, reason: 'launcher' };
		}

		const intent = new Intent(Intent.ACTION_VIEW, Uri.parse(STATION_TARGETS.identity.url));
		const icon = Icon.createWithResource(activity, activity.getApplicationInfo().icon);
		const shortcutBuilder = new ShortcutInfoBuilder(activity, 'station-identity-code');
		shortcutBuilder.setShortLabel('淘宝身份码');
		shortcutBuilder.setIntent(intent);
		shortcutBuilder.setIcon(icon);
		const shortcut = shortcutBuilder.build();

		shortcutManager.requestPinShortcut(shortcut, null);
		return { success: true };
	} catch (error) {
		console.warn('[station] 创建身份码快捷方式失败', error);
		return { success: false, reason: 'failed' };
	}
	// #endif

	return { success: false, reason: 'notApp' };
};
