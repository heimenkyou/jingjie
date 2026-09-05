<script>
	import { scheduleUpdateCheck, showPendingForceUpdate } from '@/utils/updateChecker.js';
	import { ANALYTICS_EVENTS, initAnalytics, track } from '@/utils/analytics.js';

	export default {
		onLaunch() {
			initAnalytics();
			track(ANALYTICS_EVENTS.appLaunch);

			// 捕获未处理异常并上报，便于无人值守时排查问题。
			// #ifdef APP-PLUS
			uni.onError((error) => {
				let message = String((error && error.message) || error || '');
				if (message.length > 500) message = message.slice(0, 500);
				track(ANALYTICS_EVENTS.appError, { message });
			});
			// #endif

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
		}
	}
</script>

<style>
	/*每个页面公共css */
</style>
