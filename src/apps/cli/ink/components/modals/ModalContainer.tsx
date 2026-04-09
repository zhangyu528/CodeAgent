/**
 * ModalContainer - Renders all self-contained modals
 * Place this at the root of your app
 */
import React from 'react';
import { NoticeModal } from './NoticeModal.js';
import { ConfirmModal } from './ConfirmModal.js';
import { AskModal } from './AskModal.js';
import { SelectOneModal } from './SelectOneModal.js';

export function ModalContainer() {
  return (
    <>
      <NoticeModal />
      <ConfirmModal />
      <AskModal />
      <SelectOneModal />
    </>
  );
}
