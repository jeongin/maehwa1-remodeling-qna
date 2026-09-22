import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state, CATEGORIES, $, esc, hi, fmtAt, fillCategorySelect, renderChips,
         openModal, closeModal, emptyState } from './core.js';
import { knowledge, subscribeKnowledge, onKnowledge } from './knowledge.js';

let filter = '전체', editId = null;

function setSync(ok) {
  $('syncDot').className = ok ? 'dot' : 'dot off';
  $('syncLabel').textContent = ok ? '실시간 연결됨' : '연결 오류';
}

export function subscribeFaq() { subscribeKnowledge(setSync); }

export function openFaqModal(id = null) {
  editId = id;
  const item = id ? knowledge().find(i => i.source === 'faq' && i.id === id) : null;
  $('faqModalTitle').textContent = id ? 'Q&A 수정' : '새 Q&A 추가';
  $('fCategory').value = item?.category || CATEGORIES[0];
  $('fQuestion').value = item?.question || '';
  $('fAnswer').value = item?.answer || '';
  openModal('faqModal');
  setTimeout(() => $('fQuestion').focus(), 100);
}

async function save() {
  const category = $('fCategory').value;
  const question = $('fQuestion').value.trim();
  const answer = $('fAnswer').value.trim();
  if (!question || !answer) { alert('질문과 답변을 모두 입력해주세요.'); return; }
  const btn = $('faqSaveBtn');
  btn.disabled = true;
  try {
    if (editId) {
      await updateDoc(doc(db, 'qa_items', editId), { category, question, answer, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'qa_items'), {
        category, question, answer, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    }
    closeModal('faqModal');
  } catch (e) { alert('저장 오류: ' + e.message); }
  btn.disabled = false;
}

function card(i, q) {
  const fromFaq = i.source === 'faq';
  return `
    <div class="qa-item" data-id="${esc(i.id)}" data-src="${i.source}">
      <div class="qa-question" data-act="toggle">
        <div class="qa-q-mark">Q</div>
        <div class="qa-q-content">
          <div class="qa-q-text">${hi(i.question, q)}</div>
          <div class="qa-meta">
            ${i.category ? `<span class="qa-tag">${hi(i.category, q)}</span>` : ''}
            <span class="status ${fromFaq ? 'answered' : 'open'}">${fromFaq ? '자주 묻는 질문' : '조합원 질문'}</span>
            ${i.who ? `<span class="qa-author">${esc(i.who)}</span>` : ''}
            <span class="qa-date">${fmtAt(i.at)}</span>
          </div>
        </div>
        <div class="qa-chevron">▾</div>
      </div>
      <div class="qa-answer">
        ${i.detail ? `<div class="qa-body">${hi(i.detail, q)}</div><div class="qa-divider"></div>` : ''}
        <span class="qa-a-mark">A</span><span class="qa-a-text">${hi(i.answer, q)}</span>
        ${state.isAdmin && fromFaq ? `<div class="qa-item-actions">
          <button class="btn-sm" data-act="edit">✏ 수정</button>
          <button class="btn-sm danger" data-act="delete">🗑 삭제</button>
        </div>` : ''}
      </div>
    </div>`;
}

function render() {
  const items = knowledge();
  const q = $('searchInput').value.trim().toLowerCase();
  const cats = CATEGORIES.filter(c => items.some(i => i.category === c));
  renderChips($('faqFilters'), cats, filter);

  let list = items;
  if (filter !== '전체') list = list.filter(i => i.category === filter);
  if (q) list = list.filter(i =>
    (i.question || '').toLowerCase().includes(q) ||
    (i.detail || '').toLowerCase().includes(q) ||
    (i.answer || '').toLowerCase().includes(q) ||
    (i.category || '').toLowerCase().includes(q));

  const faqCount = items.filter(i => i.source === 'faq').length;
  $('faqStats').textContent =
    `자주 묻는 질문 ${faqCount}개 · 공개 Q&A ${items.length - faqCount}개 · 표시 ${list.length}개`;

  $('faqList').innerHTML = list.length
    ? list.map(i => card(i, q)).join('')
    : emptyState(q ? '🔍' : '📋', q
      ? `'${esc(q)}'에 대한 결과가 없습니다.<br>질문 등록하기 탭에서 직접 남겨주세요.`
      : '아직 등록된 질문과 답변이 없습니다.<br>궁금한 점은 질문 등록하기 탭에서 남겨주세요.');
}

export function initFaq() {
  fillCategorySelect($('fCategory'), CATEGORIES);
  onKnowledge(render);
  $('searchInput').addEventListener('input', render);
  $('faqSaveBtn').addEventListener('click', save);
  $('faqFilters').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) { filter = chip.dataset.cat; render(); }
  });
  $('faqList').addEventListener('click', async e => {
    const target = e.target.closest('[data-act]');
    const card = e.target.closest('.qa-item');
    if (!target || !card) return;
    const id = card.dataset.id;
    if (target.dataset.act === 'toggle') card.classList.toggle('open');
    if (target.dataset.act === 'edit') openFaqModal(id);
    if (target.dataset.act === 'delete' && confirm('이 항목을 삭제하시겠습니까?')) {
      try { await deleteDoc(doc(db, 'qa_items', id)); }
      catch (err) { alert('삭제 오류: ' + err.message); }
    }
  });
}
