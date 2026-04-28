(function () {
	if (window.__jingjieSameTabWindowOpenInstalled) return;
	window.__jingjieSameTabWindowOpenInstalled = true;

	var originalOpen = typeof window.open === 'function' ? window.open.bind(window) : null;

	function normalizeUrl(url) {
		if (!url) return '';
		try {
			return new URL(url, window.location.href).toString();
		} catch (error) {
			return String(url);
		}
	}

	function navigateInSameTab(url) {
		var targetUrl = normalizeUrl(url);
		if (!targetUrl) return null;

		window.location.assign(targetUrl);
		return null;
	}

	window.open = function (url, target, features) {
		if (target === '_blank' || target === '' || target == null) {
			return navigateInSameTab(url);
		}

		if (target === '_self') {
			return navigateInSameTab(url);
		}

		return originalOpen ? originalOpen(url, target, features) : navigateInSameTab(url);
	};
})();
