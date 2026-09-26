import { state, $, closeModal } from './core.js';
import { initAuth } from './auth.js';
import { initFaq, subscribeFaq, openFaqModal } from './faq.js';
import { initBoard, subscribeBoard, openPostModal } from './board.js';
import { initPassword } from './password.js';
import { initAdmin, loadRoster } from './admin.js';

const TABS = ['notice', 'faq', 'board', 'admin'];

/** 주소의 #탭 을 읽는다. 새로고침해도 보던 탭에 그대로 남게 하려는 것. */
const tabFromHash = () => {
  const h = location.hash.slice(1);
  return TABS.includes(h) ? h : 'notice';
};

function setTab(tab) {
  state.tab = TABS.includes(tab) ? tab : 'notice';
  if (location.hash.slice(1) !== state.tab) location.hash = state.tab;
  applyTab();
}

function applyTab() {
  if (state.tab === 'admin' && !state.isAdmin) state.tab = 'notice';
  const tab = state.tab;
  $('panel-notice').hidden = tab !== 'notice';
  $('panel-faq').hidden = tab !== 'faq';
  $('panel-board').hidden = tab !== 'board';
  $('panel-admin').hidden = tab !== 'admin';
  $('tab-admin').hidden = !state.isAdmin;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  // FAQ 는 관리자만 등록. 질문 등록하기는 조합원과 관리자 모두 작성한다.
  $('fab').hidden = !state.user || tab === 'notice' || tab === 'admin'
    || (tab === 'faq' && !state.isAdmin);
  $('fab').title = tab === 'faq' ? '새 Q&A 추가' : '질문 작성';
}

function initShell() {
  $('tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (tab) setTab(tab.dataset.tab);
  });
  // 뒤로 가기로도 탭이 따라 움직인다.
  window.addEventListener('hashchange', () => setTab(tabFromHash()));

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
  setTab(signedIn ? tabFromHash() : 'notice');
  subscribeFaq();
  subscribeBoard();
  if (signedIn && state.isAdmin) loadRoster();
});
