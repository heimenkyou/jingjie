<script>
	import { scheduleUpdateCheck, showPendingForceUpdate } from '@/utils/updateChecker.js';
	import { APP_DATA_VERSION } from '@/utils/appVersion.js';
	import { STATION_LOG_PREFIX } from '@/utils/stationLog.js';
	import { clearWebviewSiteData, flushWebviewCookies } from '@/utils/webviewCookies.js';

	const STORAGE_KEYS = {
		appDataVersion: 'appDataVersion'
	};

	/**
	 * 版本号变化时清理一次 WebView 站点数据，避免旧版本残留继续污染驿站页。
	 */
	const ensureVersionScopedCleanup = () => {
		const lastVersion = uni.getStorageSync(STORAGE_KEYS.appDataVersion) || '';
		if (lastVersion === APP_DATA_VERSION) return;

		// clearWebviewSiteData(); // 不清了
		uni.setStorageSync(STORAGE_KEYS.appDataVersion, APP_DATA_VERSION);
		console.log(STATION_LOG_PREFIX, `已完成版本迁移清理: ${lastVersion || 'none'} -> ${APP_DATA_VERSION}`);
	};

	export default {
		onLaunch() {
			ensureVersionScopedCleanup();
			scheduleUpdateCheck();

			const startupTab = uni.getStorageSync('startupTab') || 'barcode';
			if (startupTab !== 'station') return;

			setTimeout(() => {
				uni.switchTab({
					url: '/pages/station/index'
				});
			}, 0);
		},
		onShow() {
			showPendingForceUpdate();
		},
		onHide() {
			flushWebviewCookies();
		}
	}
</script>

<style>
	/*每个页面公共css */
</style>
