export const DEFAULT_BACKGROUND_IMAGE = '/static/settings-background.webp';

const CUSTOM_BACKGROUND_STORAGE_KEY = 'customBackgroundImage';

/**
 * 获取当前页面背景图，未设置时使用内置默认图。
 * @returns {string} 背景图片路径
 */
export const getBackgroundImage = () => {
	return uni.getStorageSync(CUSTOM_BACKGROUND_STORAGE_KEY) || DEFAULT_BACKGROUND_IMAGE;
};

/**
 * 判断用户是否已设置自定义背景图。
 * @returns {boolean} 是否存在自定义背景图
 */
export const hasCustomBackgroundImage = () => {
	return Boolean(uni.getStorageSync(CUSTOM_BACKGROUND_STORAGE_KEY));
};

/**
 * 保存自定义背景图路径。
 * @param {string} imagePath 背景图片路径
 */
export const setCustomBackgroundImage = (imagePath) => {
	uni.setStorageSync(CUSTOM_BACKGROUND_STORAGE_KEY, imagePath);
};

/**
 * 清除自定义背景图，恢复内置默认图。
 */
export const resetCustomBackgroundImage = () => {
	uni.removeStorageSync(CUSTOM_BACKGROUND_STORAGE_KEY);
};

/**
 * 将临时背景图复制到应用私有目录，避免相册缓存被清理后失效。
 * @param {string} tempFilePath 临时背景图路径
 * @returns {Promise<string>} 保存后的本地路径，失败时为空字符串
 */
export const saveCustomBackgroundImage = (tempFilePath) => {
	return new Promise((resolve) => {
		// #ifdef APP-PLUS
		plus.io.resolveLocalFileSystemURL('_doc', (entry) => {
			entry.getDirectory('backgrounds', { create: true }, (dirEntry) => {
				plus.io.resolveLocalFileSystemURL(tempFilePath, (fileEntry) => {
					fileEntry.copyTo(dirEntry, `${Date.now()}.jpg`, (newEntry) => {
						resolve(newEntry.toLocalURL());
					}, () => resolve(''));
				}, () => resolve(''));
			}, () => resolve(''));
		}, () => resolve(''));
		// #endif

		// #ifndef APP-PLUS
		resolve(tempFilePath);
		// #endif
	});
};
