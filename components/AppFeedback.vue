<script setup>
import { getFeedbackState, resolveActionSheet, resolveModal, updateModalEditable } from '@/utils/feedback.js';

const state = getFeedbackState();

const onEditableInput = (event) => {
	updateModalEditable(event.detail.value);
};

const onModalMask = () => {
	if (state.modal.showCancel) resolveModal(false);
};

const onSheetMask = () => resolveActionSheet(-1);
const onSheetCancel = () => resolveActionSheet(-1);
const onSheetSelect = (index) => resolveActionSheet(index);
</script>

<template>
	<view>
		<view v-if="state.toast.visible" class="app-feedback-toast-wrap">
			<view class="app-feedback-toast">
				<text v-if="state.toast.icon === 'success'" class="app-feedback-toast-icon ok">✓</text>
				<text v-else-if="state.toast.icon === 'error'" class="app-feedback-toast-icon err">✕</text>
				<text class="app-feedback-toast-text">{{ state.toast.title }}</text>
			</view>
		</view>

		<view v-if="state.modal.visible" class="app-feedback-mask" @click="onModalMask">
			<view class="app-feedback-modal" @click.stop>
				<text class="app-feedback-modal-title">{{ state.modal.title }}</text>
				<text v-if="!state.modal.editable" class="app-feedback-modal-content">{{ state.modal.content }}</text>
				<input
					v-else
					class="app-feedback-modal-input"
					:value="state.modal.editableValue"
					:placeholder="state.modal.placeholderText"
					placeholder-class="app-feedback-modal-placeholder"
					@input="onEditableInput"
				/>
				<view class="app-feedback-modal-actions">
					<text v-if="state.modal.showCancel" class="app-feedback-btn cancel" @click="resolveModal(false)">{{ state.modal.cancelText }}</text>
					<text class="app-feedback-btn confirm" @click="resolveModal(true)">{{ state.modal.confirmText }}</text>
				</view>
			</view>
		</view>

		<view v-if="state.actionSheet.visible" class="app-feedback-mask" @click="onSheetMask">
			<view class="app-feedback-sheet" @click.stop>
				<view class="app-feedback-sheet-list">
					<text
						v-for="(item, index) in state.actionSheet.itemList"
						:key="index"
						class="app-feedback-sheet-item"
						@click="onSheetSelect(index)"
					>{{ item }}</text>
				</view>
				<view class="app-feedback-sheet-cancel" @click="onSheetCancel">取消</view>
			</view>
		</view>
	</view>
</template>

<style scoped>
.app-feedback-mask {
	position: fixed;
	inset: 0;
	z-index: 10000;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 40rpx;
	background: rgba(23, 38, 52, 0.32);
}

.app-feedback-toast-wrap {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 24%;
	z-index: 10001;
	display: flex;
	justify-content: center;
	padding: 0 40rpx;
	pointer-events: none;
}

.app-feedback-toast {
	display: flex;
	align-items: center;
	max-width: 100%;
	padding: 24rpx 36rpx;
	border-radius: 24rpx;
	background: rgba(30, 44, 58, 0.92);
	box-shadow: 0 16rpx 40rpx rgba(25, 53, 71, 0.24);
}

.app-feedback-toast-icon {
	margin-right: 16rpx;
	font-size: 30rpx;
	font-weight: 700;
}

.app-feedback-toast-icon.ok {
	color: #6fd6a2;
}

.app-feedback-toast-icon.err {
	color: #ff8a80;
}

.app-feedback-toast-text {
	font-size: 28rpx;
	color: #ffffff;
}

.app-feedback-modal {
	width: 100%;
	max-width: 560rpx;
	padding: 40rpx;
	border-radius: 28rpx;
	background: #ffffff;
	box-shadow: 0 24rpx 64rpx rgba(25, 53, 71, 0.2);
}

.app-feedback-modal-title {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: #243447;
}

.app-feedback-modal-content {
	display: block;
	margin-top: 24rpx;
	font-size: 26rpx;
	line-height: 1.65;
	white-space: pre-line;
	color: #4c6170;
}

.app-feedback-modal-input {
	margin-top: 24rpx;
	height: 68rpx;
	padding: 0 24rpx;
	border-radius: 16rpx;
	background: #f3f7fa;
	font-size: 28rpx;
	color: #243447;
}

.app-feedback-modal-placeholder {
	color: #a4b3c0;
}

.app-feedback-modal-actions {
	display: flex;
	justify-content: flex-end;
	gap: 40rpx;
	margin-top: 42rpx;
	font-size: 28rpx;
	font-weight: 600;
}

.app-feedback-btn {
	color: #68798a;
}

.app-feedback-btn.confirm {
	color: #3b91a8;
}

.app-feedback-sheet {
	width: 100%;
	max-width: 640rpx;
	overflow: hidden;
	border-radius: 28rpx;
	background: #ffffff;
	box-shadow: 0 24rpx 64rpx rgba(25, 53, 71, 0.2);
}

.app-feedback-sheet-list {
	padding: 40rpx 40rpx 8rpx;
}

.app-feedback-sheet-item {
	display: block;
	padding: 30rpx 0;
	text-align: center;
	font-size: 30rpx;
	color: #243447;
	border-bottom: 1rpx solid #eef3f6;
}

.app-feedback-sheet-item:last-child {
	border-bottom: none;
}

.app-feedback-sheet-cancel {
	margin-top: 20rpx;
	padding: 32rpx 0;
	text-align: center;
	font-size: 30rpx;
	font-weight: 500;
	color: #68798a;
	border-top: 1rpx solid #eef3f6;
}
</style>
