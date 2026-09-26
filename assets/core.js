import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyA9TZ_xoEY40CmQz8h1gGL2579rwMu0yso",
  authDomain: "maehwa-1-remodeling.firebaseapp.com",
  projectId: "maehwa-1-remodeling",
  storageBucket: "maehwa-1-remodeling.firebasestorage.app",
  messagingSenderId: "48080213648",
  appId: "1:48080213648:web:b9665850e766975190ea15"
};

export const app = initializeApp(firebaseConfig);

/**
 * 영구 캐시를 켠다. 다시 들어왔을 때 이전에 받아둔 문서는 캐시에서 꺼내고
 * 서버에서는 그 사이 바뀐 것만 받는다. 읽기 횟수가 줄고 첫 화면도 빨리 뜬다.
 * 시크릿 모드처럼 IndexedDB 를 못 쓰는 환경에서는 조용히 메모리 캐시로 돌아간다.
 */
function makeDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (e) {
    console.warn('영구 캐시를 쓸 수 없어 메모리 캐시로 동작합니다:', e.code || e.message);
    return getFirestore(app);
  }
}

export const db = makeDb();
export const auth = getAuth(app);

/** 조합원 계정을 만들 때 쓰는 내부 도메인. 실제로 메일이 오가지 않습니다. */
export const RESIDENT_DOMAIN = 'resident.maehwa1.kr';

/**
 * Firebase 비밀번호 = 이 접두사 + 사용자가 입력한 값.
 * 최초 입력값은 휴대폰 뒷 4자리라 6자 최소 길이를 못 채우므로 접두사로 보강한다.
 */
export const PW_PREFIX = 'mh1!';

/**
 * 질문 게시판과 FAQ 가 함께 쓰는 카테고리.
 * firestore.rules 의 create 검증 목록과 반드시 일치해야 한다.
 */
export const CATEGORIES = ['법무·세무·회계', '설계', '이주·이주비', '총회', '주민설명회', '기타'];

/** 화면 전체가 공유하는 상태 */
export const state = { user: null, isAdmin: false, dong: '', ho: '', tab: 'notice' };

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

/** 날짜 + 시:분. 질문·답변 시각처럼 분 단위가 필요한 곳에 쓴다. */
export function fmtAt(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

/** 카테고리 <select> 채우기 */
export function fillCategorySelect(el, cats) {
  el.innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
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
