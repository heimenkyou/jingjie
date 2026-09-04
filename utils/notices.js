const NOTICE_URL = 'https://jingjie.luowb.cn/notices.json';
const DEFAULT_POLL_INTERVAL_SECONDS = 7200;
const STORAGE_KEYS = {
	cache: 'globalNoticeCache',
	lastFetchAt: 'globalNoticeLastFetchAt',
	dismissedIds: 'globalNoticeDismissedIds'
};
const ROUTE_ACTIONS = {
	navigate: 'navigateTo',
	redirect: 'redirectTo',
	relaunch: 'reLaunch',
	tab: 'switchTab'
};
const ACTION_TYPES = new Set([...Object.keys(ROUTE_ACTIONS), 'external']);
const ROUTE_URL_PATTERN = /^\/pages\/[a-zA-Z0-9_/-]+(?:\?[^\s]*)?$/;
const EXTERNAL_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

let inFlightRequest = null;

/**
 * 获取当前时间戳。
 * @returns {number}
 */
const now = () => Date.now();

/**
 * 将本地存储值解析为对象。
 * @param {unknown} value 原始存储值
 * @param {unknown} fallback 解析失败时的默认值
 * @returns {unknown}
 */
const parseObject = (value, fallback) => {
	if (!value) return fallback;
	if (typeof value === 'object') return value;

	try {
		return JSON.parse(value);
	} catch (error) {
		return fallback;
	}
};

/**
 * 获取已关闭公告的 id 列表。
 * @returns {string[]}
 */
const getDismissedIds = () => {
	const value = parseObject(uni.getStorageSync(STORAGE_KEYS.dismissedIds), []);
	return Array.isArray(value) ? value : [];
};

/**
 * 保存已关闭公告的 id 列表。
 * @param {string[]} ids 公告 id 列表
 */
const setDismissedIds = (ids) => {
	uni.setStorageSync(STORAGE_KEYS.dismissedIds, ids);
};

/**
 * 标准化公告动作，避免远程配置直接决定调用的 API。
 * @param {unknown} action 远程动作配置
 * @returns {{ type: string, url: string, label?: string } | null}
 */
const normalizeNoticeAction = (action) => {
	if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
	const { type, url, label } = action;
	if (!ACTION_TYPES.has(type) || typeof url !== 'string') return null;

	const isValidUrl = type === 'external' ? EXTERNAL_URL_PATTERN.test(url) : ROUTE_URL_PATTERN.test(url);
	if (!isValidUrl) return null;

	return {
		type,
		url,
		...(typeof label === 'string' && label.trim() ? { label: label.trim() } : {})
	};
};

/**
 * 标准化单条公告，隔离远程协议中的不可信字段。
 * @param {unknown} item 远程公告
 * @returns {object | null}
 */
const normalizeNotice = (item) => {
	if (!item || typeof item !== 'object' || !item.id || !item.content) return null;

	const action = normalizeNoticeAction(item.action);
	return {
		...item,
		action
	};
};

/**
 * 过滤不可展示的公告。
 * @param {unknown[]} items 远程公告列表
 * @returns {object[]}
 */
const normalizeItems = (items = []) => {
	const dismissedIds = new Set(getDismissedIds());
	const currentTime = now();

	return items
		.map(normalizeNotice)
		.filter((item) => {
			if (!item) return false;
			if (item.expireAt && Number(item.expireAt) < currentTime) return false;
			if (dismissedIds.has(item.id)) return false;
			return true;
		});
};

/**
 * 获取本地缓存中的公告载荷。
 * @returns {{ globalEnable: boolean, pollInterval: number, items: object[] } | null}
 */
const getCachedPayload = () => {
	const payload = parseObject(uni.getStorageSync(STORAGE_KEYS.cache), null);
	if (!payload || typeof payload !== 'object') return null;

	return {
		globalEnable: payload.globalEnable !== false,
		pollInterval: Number(payload.pollInterval) || DEFAULT_POLL_INTERVAL_SECONDS,
		items: normalizeItems(Array.isArray(payload.items) ? payload.items : [])
	};
};

/**
 * 判断是否需要拉取远程公告。
 * @param {{ pollInterval?: number } | null} cachedPayload 缓存载荷
 * @param {boolean} force 是否强制刷新
 * @returns {boolean}
 */
const shouldFetchRemote = (cachedPayload, force = false) => {
	if (force) return true;
	const lastFetchAt = Number(uni.getStorageSync(STORAGE_KEYS.lastFetchAt) || 0);
	const pollInterval = (cachedPayload?.pollInterval || DEFAULT_POLL_INTERVAL_SECONDS) * 1000;
	return now() - lastFetchAt >= pollInterval;
};

/**
 * 保存远程公告原始载荷，便于后续按新规则重新校验。
 * @param {object} payload 远程公告载荷
 */
const savePayload = (payload) => {
	uni.setStorageSync(STORAGE_KEYS.cache, payload);
	uni.setStorageSync(STORAGE_KEYS.lastFetchAt, now());
};

/**
 * 请求远程公告载荷。
 * @returns {Promise<object>}
 */
const requestRemotePayload = () =>
	new Promise((resolve, reject) => {
		uni.request({
			url: NOTICE_URL,
			method: 'GET',
			timeout: 3000,
			success: (res) => {
				if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
					try {
						resolve(typeof res.data === 'string' ? JSON.parse(res.data) : res.data);
					} catch (error) {
						reject(error);
					}
					return;
				}

				reject(new Error(`公告请求失败: ${res.statusCode}`));
			},
			fail: reject
		});
	});

/**
 * 读取全局公告，优先复用本地缓存，必要时再发起远程请求。
 * @param {{ force?: boolean }} [options] 控制是否强制拉取远程配置
 * @returns {Promise<{ globalEnable: boolean, pollInterval: number, items: Array<object> }>}
 */
export const loadGlobalNotices = async ({ force = false } = {}) => {
	const cachedPayload = getCachedPayload();
	if (cachedPayload && !shouldFetchRemote(cachedPayload, force)) {
		return cachedPayload;
	}

	if (inFlightRequest) {
		try {
			return await inFlightRequest;
		} catch (error) {
			return cachedPayload || { globalEnable: false, pollInterval: DEFAULT_POLL_INTERVAL_SECONDS, items: [] };
		}
	}

	inFlightRequest = requestRemotePayload()
		.then((payload) => {
			const normalizedPayload = {
				globalEnable: payload?.globalEnable !== false,
				pollInterval: Number(payload?.pollInterval) || DEFAULT_POLL_INTERVAL_SECONDS,
				items: normalizeItems(Array.isArray(payload?.items) ? payload.items : [])
			};
			savePayload(payload);
			return normalizedPayload;
		})
		.catch((error) => {
			console.warn('加载全局公告失败:', error);
			return cachedPayload || { globalEnable: false, pollInterval: DEFAULT_POLL_INTERVAL_SECONDS, items: [] };
		})
		.finally(() => {
			inFlightRequest = null;
		});

	return inFlightRequest;
};

/**
 * 执行已校验的公告动作。
 * @param {{ type: string, url: string } | null} action 公告动作
 */
export const executeNoticeAction = (action) => {
	const normalizedAction = normalizeNoticeAction(action);
	if (!normalizedAction) return;

	if (normalizedAction.type === 'external') {
		// #ifdef APP-PLUS
		plus.runtime.openURL(normalizedAction.url);
		// #endif

		// #ifdef H5
		window.location.href = normalizedAction.url;
		// #endif
		return;
	}

	uni[ROUTE_ACTIONS[normalizedAction.type]]({
		url: normalizedAction.url
	});
};

/**
 * 记录用户已关闭的公告，后续拉取时直接过滤掉。
 * @param {string} noticeId 公告 id
 */
export const dismissGlobalNotice = (noticeId) => {
	if (!noticeId) return;
	const ids = getDismissedIds();
	if (ids.includes(noticeId)) return;
	ids.push(noticeId);
	setDismissedIds(ids);
};
