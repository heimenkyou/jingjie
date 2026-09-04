const STORAGE_KEY = 'stationAutoOpenTarget';

export const STATION_TARGETS = {
	identity: {
		key: 'identity',
		label: '身份码',
		url: 'taobao://m.taobao.com/tbopen/index.html?h5Url=https://pages-fast.m.taobao.com/wow/z/uniapp/1100410/last-mile-fe/m-end-identity-code/home'
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
 * 读取与页面入口一致的快捷方式图标。
 * @param {{key: string}} target 驿站目标
 * @returns {android.graphics.drawable.Icon}
 */
const createShortcutIcon = (target) => {
	const Icon = plus.android.importClass('android.graphics.drawable.Icon');
	const BitmapFactory = plus.android.importClass('android.graphics.BitmapFactory');
	const iconPath = target.key === 'identity'
		? '_www/static/barcode-icon-active.png'
		: '_www/static/station-icon-active.png';
	const bitmap = BitmapFactory.decodeFile(plus.io.convertLocalFileSystemURL(iconPath));
	if (bitmap) return Icon.createWithBitmap(bitmap);

	return Icon.createWithResource(plus.android.runtimeMainActivity(), plus.android.runtimeMainActivity().getApplicationInfo().icon);
};

/**
 * 请求将指定驿站入口固定到 Android 桌面。
 * @param {string} key 驿站目标标识
 * @returns {{success: boolean, reason?: string}} 请求结果
 */
export const requestStationShortcut = (key) => {
	// #ifdef APP-PLUS
	if (typeof plus === 'undefined' || !plus.android) return { success: false, reason: 'notApp' };
	const target = STATION_TARGETS[key];
	if (!target) return { success: false, reason: 'failed' };

	try {
		const activity = plus.android.runtimeMainActivity();
		const BuildVersion = plus.android.importClass('android.os.Build$VERSION');
		if (BuildVersion.SDK_INT < 26) return { success: false, reason: 'version' };

		const Intent = plus.android.importClass('android.content.Intent');
		const Uri = plus.android.importClass('android.net.Uri');
		const ShortcutInfoBuilder = plus.android.importClass('android.content.pm.ShortcutInfo$Builder');
		const shortcutManager = activity.getSystemService('shortcut');
		if (!shortcutManager) {
			return { success: false, reason: 'launcher' };
		}
		plus.android.importClass(shortcutManager);
		if (typeof shortcutManager.isRequestPinShortcutSupported !== 'function' || !shortcutManager.isRequestPinShortcutSupported()) {
			return { success: false, reason: 'launcher' };
		}

		const intent = new Intent(Intent.ACTION_VIEW, Uri.parse(target.url));
		const shortcutBuilder = new ShortcutInfoBuilder(activity, `station-${target.key}`);
		shortcutBuilder.setShortLabel(target.label);
		shortcutBuilder.setIntent(intent);
		shortcutBuilder.setIcon(createShortcutIcon(target));
		const shortcut = shortcutBuilder.build();
		const shortcutId = `station-${target.key}`;
		const pinnedShortcuts = shortcutManager.getPinnedShortcuts();
		plus.android.importClass(pinnedShortcuts);
		let exists = false;
		for (let index = 0; index < pinnedShortcuts.size(); index += 1) {
			const pinnedShortcut = pinnedShortcuts.get(index);
			plus.android.importClass(pinnedShortcut);
			if (pinnedShortcut.getId() === shortcutId) {
				exists = true;
				break;
			}
		}

		if (exists) {
			const ArrayList = plus.android.importClass('java.util.ArrayList');
			const shortcuts = new ArrayList();
			shortcuts.add(shortcut);
			shortcutManager.updateShortcuts(shortcuts);
			return { success: true, updated: true };
		}

		shortcutManager.requestPinShortcut(shortcut, null);
		return { success: true };
	} catch (error) {
		console.warn('[station] 创建身份码快捷方式失败', error);
		return { success: false, reason: 'failed' };
	}
	// #endif

	return { success: false, reason: 'notApp' };
};
