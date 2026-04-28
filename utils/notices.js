const NOTICE_URL = 'https://jingjie.luowb.cn/notices.json';
const DEFAULT_POLL_INTERVAL_SECONDS = 7200;
const STORAGE_KEYS = {
	cache: 'globalNoticeCache',
	lastFetchAt: 'globalNoticeLastFetchAt',
	dismissedIds: 'globalNoticeDismissedIds'
};

let inFlightRequest = null;

const now = () => Date.now();

const parseObject = (value, fallback) => {
	if (!value) return fallback;
	if (typeof value === 'object') return value;

	try {
		return JSON.parse(value);
	} catch (error) {
		return fallback;
	}
};

const getDismissedIds = () => {
	const value = parseObject(uni.getStorageSync(STORAGE_KEYS.dismissedIds), []);
	return Array.isArray(value) ? value : [];
};

const setDismissedIds = (ids) => {
	uni.setStorageSync(STORAGE_KEYS.dismissedIds, ids);
};

const normalizeItems = (items = []) => {
	const dismissedIds = new Set(getDismissedIds());
	const currentTime = now();

	return items.filter((item) => {
		if (!item || !item.id || !item.content) return false;
		if (item.expireAt && Number(item.expireAt) < currentTime) return false;
		if (dismissedIds.has(item.id)) return false;
		return true;
	});
};

const getCachedPayload = () => {
	const payload = parseObject(uni.getStorageSync(STORAGE_KEYS.cache), null);
	if (!payload || typeof payload !== 'object') return null;

	return {
		globalEnable: payload.globalEnable !== false,
		pollInterval: Number(payload.pollInterval) || DEFAULT_POLL_INTERVAL_SECONDS,
		items: normalizeItems(Array.isArray(payload.items) ? payload.items : [])
	};
};

const shouldFetchRemote = (cachedPayload, force = false) => {
	if (force) return true;
	const lastFetchAt = Number(uni.getStorageSync(STORAGE_KEYS.lastFetchAt) || 0);
	const pollInterval = (cachedPayload?.pollInterval || DEFAULT_POLL_INTERVAL_SECONDS) * 1000;
	return now() - lastFetchAt >= pollInterval;
};

const savePayload = (payload) => {
	uni.setStorageSync(STORAGE_KEYS.cache, payload);
	uni.setStorageSync(STORAGE_KEYS.lastFetchAt, now());
};

const requestRemotePayload = () =>
	new Promise((resolve, reject) => {
		uni.request({
			url: NOTICE_URL,
			method: 'GET',
			timeout: 3000,
			success: (res) => {
				if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
					resolve(typeof res.data === 'string' ? JSON.parse(res.data) : res.data);
					return;
				}
				reject(new Error(`公告请求失败: ${res.statusCode}`));
			},
			fail: reject
		});
	});

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

export const dismissGlobalNotice = (noticeId) => {
	if (!noticeId) return;
	const ids = getDismissedIds();
	if (ids.includes(noticeId)) return;
	ids.push(noticeId);
	setDismissedIds(ids);
};
