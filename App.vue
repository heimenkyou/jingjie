<script>
	import { scheduleUpdateCheck, showPendingForceUpdate } from '@/utils/updateChecker.js';
	import { APP_DATA_VERSION } from '@/utils/appVersion.js';
	import { clearWebviewSiteData, flushWebviewCookies } from '@/utils/webviewCookies.js';
	const STORAGE_KEYS = {
		appDataVersion: 'appDataVersion'
	};

	const ensureVersionScopedCleanup = () => {
		const lastVersion = uni.getStorageSync(STORAGE_KEYS.appDataVersion) || '';
		if (lastVersion === APP_DATA_VERSION) return;

		clearWebviewSiteData();
		uni.setStorageSync(STORAGE_KEYS.appDataVersion, APP_DATA_VERSION);
		console.log(`已完成版本迁移清理: ${lastVersion || 'none'} -> ${APP_DATA_VERSION}`);
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
