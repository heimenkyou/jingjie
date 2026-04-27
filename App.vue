<script>
	import { scheduleUpdateCheck, showPendingForceUpdate } from '@/utils/updateChecker.js';
	import { flushWebviewCookies } from '@/utils/webviewCookies.js';

	export default {
		onLaunch() {
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
