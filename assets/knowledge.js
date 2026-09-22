import { collection, query, where, orderBy, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state, esc } from './core.js';

let faqItems = [], pubItems = [], unsubs = [], listeners = [];

export function onKnowledge(fn) { listeners.push(fn); }
const notify = () => listeners.forEach(f => f());

/** FAQ 와 답변이 끝난 공개 질문을 한 목록으로 본다. 조합원이 답을 찾는 곳. */
export function knowledge() {
  return [
    ...faqItems.map(i => ({
      id: i.id, source: 'faq', category: i.category,
      question: i.question, detail: '', answer: i.answer, at: i.createdAt
    })),
    ...pubItems.map(p => ({
      id: p.id, source: 'board', category: p.category,
      question: p.title, detail: p.content, answer: p.answer,
      who: p.authorDong && p.authorHo ? `${p.authorDong}동 ${p.authorHo}호` : '',
      at: p.answeredAt || p.createdAt
    }))
  ].sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0));
}

export function subscribeKnowledge(onSync) {
  unsubs.forEach(u => u());
  unsubs = [];
  faqItems = []; pubItems = [];
  if (!state.user) { notify(); return; }
  unsubs.push(onSnapshot(
    query(collection(db, 'qa_items'), orderBy('createdAt', 'desc')),
    s => { faqItems = s.docs.map(d => ({ id: d.id, ...d.data() })); onSync(true); notify(); },
    () => onSync(false)));
  unsubs.push(onSnapshot(
    query(collection(db, 'questions'), where('isPublic', '==', true), where('status', '==', 'answered')),
    s => { pubItems = s.docs.map(d => ({ id: d.id, ...d.data() })); notify(); },
    () => {}));
}

/** 내용 없이 질문 형태만 만드는 말. 이것까지 세면 엉뚱한 글이 걸린다. */
const STOP = new Set(['어떻게', '하나요', '되나요', '있나요', '인가요', '가능한가요', '한가요',
  '무엇', '어디', '어떤', '건가요', '될까요', '할까요', '나요', '까요', '인지', '알고', '싶습니다',
  '궁금합니다', '궁금해요', '문의', '질문', '해주세요', '알려주세요']);

/** 어미를 걷어낸 낱말만 남긴다. 그래야 "어떻게 하나요" 끼리 겹쳐 엉뚱한 글이 걸리지 않는다. */
function words(s) {
  return String(s || '').toLowerCase().split(/\s+/)
    .map(w => w.replace(/[^0-9a-z가-힣]/g, ''))
    .filter(w => w.length >= 2 && !STOP.has(w));
}

/** 두 글자씩 끊어 만든 집합. 한국어는 형태소 분석 없이도 이 정도면 충분히 잡힌다. */
function grams(s) {
  const t = words(s).join('');
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

/** 입력한 글자 중 상대 문서에 얼마나 담겨 있는지의 비율 */
function gramScore(a, b) {
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const g of A) if (B.has(g)) hit++;
  return hit / A.size;
}

/** 낱말이 그대로 들어 있는지 본다. 긴 낱말일수록 크게 친다. */
function wordScore(input, target) {
  const t = String(target || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  const toks = words(input);
  if (!toks.length || !t) return 0;
  let hit = 0, total = 0;
  for (const w of toks) {
    total += w.length;
    if (t.includes(w)) hit += w.length;
    // 끝의 조사 한 글자는 떼고 한 번 더 본다. (분담금은 → 분담금)
    else if (w.length > 2 && t.includes(w.slice(0, -1))) hit += w.length - 1;
  }
  return hit / total;
}

const score = (input, target) => Math.max(gramScore(input, target), wordScore(input, target));

export function findSimilar(text, limit = 3, excludeId = null) {
  if (String(text || '').replace(/\s/g, '').length < 4) return [];
  return knowledge()
    .filter(k => k.id !== excludeId)
    .map(k => ({
      k,
      score: Math.max(
        score(text, k.question),
        score(text, k.detail) * 0.8,
        score(text, k.answer) * 0.7)
    }))
    .filter(x => x.score >= 0.28)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.k);
}

const hitsFor = new WeakMap();

/** 제안 영역의 클릭 처리를 한 번만 걸어둔다. onPick 이 있으면 연결 버튼이 붙는다. */
export function initSuggestions(el, onPick) {
  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-sug]');
    if (!btn) return;
    const row = btn.closest('.sug-row');
    const hit = (hitsFor.get(el) || [])[Number(row.dataset.idx)];
    if (!hit) return;
    if (btn.dataset.sug === 'view') {
      const box = row.querySelector('.sug-a');
      box.hidden = !box.hidden;
      btn.textContent = box.hidden ? '답변 보기' : '접기';
    }
    if (btn.dataset.sug === 'pick' && onPick) onPick(hit);
  });
}

export function renderSuggestions(el, text, opts = {}) {
  const hits = findSimilar(text, 3, opts.excludeId);
  hitsFor.set(el, hits);
  if (!hits.length) { el.hidden = true; el.innerHTML = ''; return 0; }
  el.hidden = false;
  el.innerHTML = `
    <div class="sug-head">💡 ${esc(opts.head || '비슷한 질문에 이미 답변이 있어요')}</div>
    ${hits.map((k, i) => `
      <div class="sug-row" data-idx="${i}">
        <div class="sug-main">
          <div class="sug-meta">
            <span class="qa-tag">${esc(k.category || '기타')}</span>
            <span class="sug-src">${k.source === 'faq' ? '자주 묻는 질문' : '조합원 질문'}</span>
          </div>
          <div class="sug-q">${esc(k.question)}</div>
          <div class="sug-a" hidden>${esc(k.answer)}</div>
        </div>
        <div class="sug-btns">
          <button type="button" class="btn-sm" data-sug="view">답변 보기</button>
          ${opts.pickLabel ? `<button type="button" class="btn-sm" data-sug="pick">${esc(opts.pickLabel)}</button>` : ''}
        </div>
      </div>`).join('')}
    ${opts.foot ? `<div class="sug-foot">${esc(opts.foot)}</div>` : ''}`;
  return hits.length;
}
