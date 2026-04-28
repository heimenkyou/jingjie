const STORAGE_KEYS = {
	viewerAuto: 'viewerAutoBrightnessEnabled',
	stationAuto: 'stationAutoBrightnessEnabled',
	manualHintShown: 'brightnessManualHintShown'
};

export const BRIGHTNESS_SCENES = {
	viewer: 'viewer',
	station: 'station'
};

const sceneStorageKeyMap = {
	[BRIGHTNESS_SCENES.viewer]: STORAGE_KEYS.viewerAuto,
	[BRIGHTNESS_SCENES.station]: STORAGE_KEYS.stationAuto
};

const sceneStateMap = new Map();

/**
 * 判断当前是否运行在 App 原生环境。
 * @returns {boolean}
 */
const isAppPlus = () => typeof plus !== 'undefined';

/**
 * 规范化亮度值，确保始终落在 0 到 1 之间。
 * @param {number|string} value 亮度值
 * @returns {number}
 */
const normalizeBrightnessValue = (value) => {
	const normalized = Number(value);
	if (Number.isNaN(normalized)) return 0.5;
	return Math.min(1, Math.max(0, normalized));
};

/**
 * 获取页面场景对应的亮度状态，不存在时自动初始化。
 * @param {string} scene 页面场景
 * @returns {{originalBrightness: number | null, boosted: boolean}}
 */
const getSceneState = (scene) => {
	if (!sceneStateMap.has(scene)) {
		sceneStateMap.set(scene, {
			originalBrightness: null,
			boosted: false
		});
	}
	return sceneStateMap.get(scene);
};

/**
 * 读取当前系统亮度，失败时返回中间值兜底。
 * @returns {Promise<number>}
 */
const getScreenBrightness = () =>
	new Promise((resolve) => {
		if (!isAppPlus() || typeof uni.getScreenBrightness !== 'function') {
			resolve(0.5);
			return;
		}

		uni.getScreenBrightness({
			success: (res) => {
				resolve(normalizeBrightnessValue(res?.value));
			},
			fail: () => {
				resolve(0.5);
			}
		});
	});

/**
 * 设置当前系统亮度。
 * @param {number} value 目标亮度
 * @returns {Promise<boolean>}
 */
const setScreenBrightness = (value) =>
	new Promise((resolve) => {
		if (!isAppPlus() || typeof uni.setScreenBrightness !== 'function') {
			resolve(false);
			return;
		}

		uni.setScreenBrightness({
			value: normalizeBrightnessValue(value),
			complete: () => resolve(true)
		});
	});

/**
 * 读取某个页面场景的自动点亮开关。
 * @param {string} scene 页面场景
 * @returns {boolean}
 */
export const isSceneAutoBrightnessEnabled = (scene) => {
	const storageKey = sceneStorageKeyMap[scene];
	if (!storageKey) return false;
	return !!uni.getStorageSync(storageKey);
};

/**
 * 保存某个页面场景的自动点亮开关。
 * @param {string} scene 页面场景
 * @param {boolean} enabled 是否开启
 */
export const setSceneAutoBrightnessEnabled = (scene, enabled) => {
	const storageKey = sceneStorageKeyMap[scene];
	if (!storageKey) return;
	uni.setStorageSync(storageKey, !!enabled);
};

/**
 * 读取所有亮度偏好设置，供设置页统一展示。
 * @returns {{viewerAuto: boolean, stationAuto: boolean}}
 */
export const getBrightnessPreferences = () => ({
	viewerAuto: isSceneAutoBrightnessEnabled(BRIGHTNESS_SCENES.viewer),
	stationAuto: isSceneAutoBrightnessEnabled(BRIGHTNESS_SCENES.station)
});

/**
 * 在首次进入页面时记录原始亮度，供离开时恢复。
 * @param {string} scene 页面场景
 * @returns {Promise<number>}
 */
export const ensureOriginalBrightnessCaptured = async (scene) => {
	const state = getSceneState(scene);
	if (state.originalBrightness === null) {
		state.originalBrightness = await getScreenBrightness();
	}
	return state.originalBrightness;
};

/**
 * 将指定页面场景的亮度拉满。
 * @param {string} scene 页面场景
 * @returns {Promise<boolean>}
 */
export const boostSceneBrightness = async (scene) => {
	await ensureOriginalBrightnessCaptured(scene);
	const state = getSceneState(scene);
	if (!isAppPlus()) {
		state.boosted = true;
		return true;
	}

	const success = await setScreenBrightness(1);
	if (success) {
		state.boosted = true;
	}
	return success;
};

/**
 * 将指定页面场景恢复到进入前的原始亮度。
 * @param {string} scene 页面场景
 * @returns {Promise<boolean>}
 */
export const restoreSceneBrightness = async (scene) => {
	const state = getSceneState(scene);
	if (state.originalBrightness === null) {
		state.boosted = false;
		return false;
	}

	if (!isAppPlus()) {
		state.originalBrightness = null;
		state.boosted = false;
		return true;
	}

	const success = await setScreenBrightness(state.originalBrightness);
	state.originalBrightness = null;
	state.boosted = false;
	return success;
};

/**
 * 切换指定页面场景的亮度状态。
 * @param {string} scene 页面场景
 * @returns {Promise<boolean>} `true` 表示切到高亮，`false` 表示恢复原亮度
 */
export const toggleSceneBrightness = async (scene) => {
	const state = getSceneState(scene);
	if (state.boosted) {
		await restoreSceneBrightness(scene);
		return false;
	}

	return await boostSceneBrightness(scene);
};

/**
 * 判断指定页面场景当前是否处于高亮状态。
 * @param {string} scene 页面场景
 * @returns {boolean}
 */
export const isSceneBrightnessBoosted = (scene) => {
	return !!getSceneState(scene).boosted;
};

/**
 * 判断是否需要展示首次手动点亮提醒。
 * @returns {boolean}
 */
export const shouldShowManualBrightnessHint = () => {
	return !uni.getStorageSync(STORAGE_KEYS.manualHintShown);
};

/**
 * 标记首次手动点亮提醒已经展示过。
 */
export const markManualBrightnessHintShown = () => {
	uni.setStorageSync(STORAGE_KEYS.manualHintShown, true);
};
