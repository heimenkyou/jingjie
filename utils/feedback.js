import { reactive } from 'vue';

const state = reactive({
	toast: { visible: false, title: '', icon: 'none' },
	modal: { visible: false, title: '', content: '', showCancel: true, confirmText: '确定', cancelText: '取消', editable: false, placeholderText: '', editableValue: '', resolveConfirm: null },
	actionSheet: { visible: false, itemList: [], resolveSelect: null }
});

let toastTimer = null;

const clearToastTimer = () => {
	if (toastTimer) {
		clearTimeout(toastTimer);
		toastTimer = null;
	}
};

/**
 * 弹出一条符合应用风格的轻提示，自动消失。
 * @param {{ title: string, icon?: 'none'|'success'|'error', duration?: number }} options 提示配置
 */
export const showToast = ({ title = '', icon = 'none', duration = 2200 } = {}) => {
	clearToastTimer();
	state.toast = { visible: true, title, icon };
	toastTimer = setTimeout(() => {
		state.toast.visible = false;
	}, duration);
};

/**
 * 弹出确认/输入弹窗，以 Promise 返回结果。
 * @param {{ title?: string, content?: string, showCancel?: boolean, confirmText?: string, cancelText?: string, editable?: boolean, placeholderText?: string }} options 弹窗配置
 * @returns {Promise<{ confirm: boolean, content: string }>}
 */
export const showModal = ({ title = '', content = '', showCancel = true, confirmText = '确定', cancelText = '取消', editable = false, placeholderText = '' } = {}) => {
	return new Promise((resolve) => {
		state.modal = { visible: true, title, content, showCancel, confirmText, cancelText, editable, placeholderText, editableValue: placeholderText, resolveConfirm: resolve };
	});
};

/**
 * 弹出底部选择面板，以标签索引作为结果，取消时返回 -1。
 * @param {{ itemList: string[] }} options 选择项配置
 * @returns {Promise<number>}
 */
export const showActionSheet = ({ itemList = [] } = {}) => {
	return new Promise((resolve) => {
		state.actionSheet = { visible: true, itemList, resolveSelect: resolve };
	});
};

/**
 * 供给组件读取的反馈状态。
 */
export const getFeedbackState = () => state;

/**
 * 更新弹窗内输入框的值。
 * @param {string} value 输入内容
 */
export const updateModalEditable = (value) => {
	state.modal.editableValue = value;
};

/**
 * 由组件在点击确认/取消时调用，关闭弹窗并返回结果。
 * @param {boolean} confirmed 是否确认
 */
export const resolveModal = (confirmed) => {
	const resolve = state.modal.resolveConfirm;
	state.modal.visible = false;
	state.modal.resolveConfirm = null;
	resolve?.({ confirm: confirmed, content: confirmed ? state.modal.editableValue : '' });
};

/**
 * 由组件在选择面板时调用，关闭面板并返回索引。
 * @param {number} index 选中索引，取消为 -1
 */
export const resolveActionSheet = (index) => {
	const resolve = state.actionSheet.resolveSelect;
	state.actionSheet.visible = false;
	state.actionSheet.resolveSelect = null;
	resolve?.(index);
};
