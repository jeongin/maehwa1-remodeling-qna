import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9TZ_xoEY40CmQz8h1gGL2579rwMu0yso",
  authDomain: "maehwa-1-remodeling.firebaseapp.com",
  projectId: "maehwa-1-remodeling",
  storageBucket: "maehwa-1-remodeling.firebasestorage.app",
  messagingSenderId: "48080213648",
  appId: "1:48080213648:web:b9665850e766975190ea15"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

/** 조합원 계정을 만들 때 쓰는 내부 도메인. 실제로 메일이 오가지 않습니다. */
export const RESIDENT_DOMAIN = 'resident.maehwa1.kr';

/** 질문 게시판 카테고리 (firestore.rules 의 목록과 반드시 일치해야 함) */
export const CATEGORIES = ['법무·세무·회계', '설계', '이주·이주비', '기타'];

/** 화면 전체가 공유하는 상태 */
export const state = { user: null, isAdmin: false, dong: '', ho: '', tab: 'faq' };

export const $ = id => document.getElementById(id);

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function hi(text, q) {
  if (!q) return esc(text);
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return esc(text).replace(new RegExp(`(${safe})`, 'gi'), '<mark>$1</mark>');
}

export function fmt(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** 카테고리 <select> 채우기 */
export function fillCategorySelect(el, includeEmpty = false) {
  el.innerHTML = (includeEmpty ? '<option value="">(없음)</option>' : '') +
    CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

/** 칩 필터 줄 그리기. cats 는 표시할 카테고리 배열. */
export function renderChips(el, cats, active) {
  el.innerHTML = ['전체', ...cats]
    .map(c => `<div class="chip ${active === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</div>`)
    .join('');
}

export function openModal(id) { $(id).classList.add('show'); }
export function closeModal(id) { $(id).classList.remove('show'); }

export function emptyState(emoji, html) {
  return `<div class="empty-state"><div class="emoji">${emoji}</div><p>${html}</p></div>`;
}
