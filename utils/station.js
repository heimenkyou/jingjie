const STORAGE_KEY = 'stationAutoOpenTarget';

export const STATION_TARGETS = {
	identity: {
		key: 'identity',
		label: '身份码',
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
 * 绘制快捷方式图标，避免两个入口在桌面上难以区分。
 * @param {{key: string}} target 驿站目标
 * @returns {android.graphics.drawable.Icon}
 */
const createShortcutIcon = (target) => {
	const Bitmap = plus.android.importClass('android.graphics.Bitmap');
	const Canvas = plus.android.importClass('android.graphics.Canvas');
	const Color = plus.android.importClass('android.graphics.Color');
	const Paint = plus.android.importClass('android.graphics.Paint');
	const bitmap = Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888);
	const canvas = new Canvas(bitmap);
	const paint = new Paint(Paint.ANTI_ALIAS_FLAG);

	paint.setColor(Color.parseColor(target.key === 'identity' ? '#3B91A8' : '#5E8D79'));
	canvas.drawRoundRect(0, 0, 192, 192, 48, 48, paint);
	paint.setColor(Color.WHITE);
	paint.setTextSize(88);
	paint.setTextAlign(Paint.Align.CENTER);
	paint.setFakeBoldText(true);
	canvas.drawText(target.key === 'identity' ? '码' : '站', 96, 126, paint);

	const Icon = plus.android.importClass('android.graphics.drawable.Icon');
	return Icon.createWithBitmap(bitmap);
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

		shortcutManager.requestPinShortcut(shortcut, null);
		return { success: true };
	} catch (error) {
		console.warn('[station] 创建身份码快捷方式失败', error);
		return { success: false, reason: 'failed' };
	}
	// #endif

	return { success: false, reason: 'notApp' };
};
