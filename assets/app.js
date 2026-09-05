import { state, $, closeModal } from './core.js';
import { initAuth } from './auth.js';
import { initFaq, subscribeFaq, openFaqModal } from './faq.js';
import { initBoard, subscribeBoard, openPostModal } from './board.js';
import { initPassword } from './password.js';
import { initAdmin, loadRoster } from './admin.js';

function applyTab() {
  if (state.tab === 'admin' && !state.isAdmin) state.tab = 'faq';
  const tab = state.tab;
  $('panel-faq').hidden = tab !== 'faq';
  $('panel-board').hidden = tab !== 'board';
  $('panel-admin').hidden = tab !== 'admin';
  $('tab-admin').hidden = !state.isAdmin;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  // FAQ 는 관리자만 등록. 질문 등록하기는 조합원과 관리자 모두 작성한다.
  $('fab').hidden = !state.user || tab === 'admin' || (tab === 'faq' && !state.isAdmin);
  $('fab').title = tab === 'faq' ? '새 Q&A 추가' : '질문 작성';
}

function initShell() {
  $('tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    state.tab = tab.dataset.tab;
    applyTab();
  });

  $('fab').addEventListener('click', () => {
    if (state.tab === 'faq') openFaqModal(); else openPostModal();
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay && overlay.dataset.locked !== '1') overlay.classList.remove('show');
    });
  });
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.show')
      .forEach(m => { if (m.dataset.locked !== '1') m.classList.remove('show'); });
  });
}

initShell();
initFaq();
initBoard();
initPassword();
initAdmin();

initAuth(signedIn => {
  if (!signedIn) state.tab = 'faq';
  applyTab();
  subscribeFaq();
  subscribeBoard();
  if (signedIn && state.isAdmin) loadRoster();
});
