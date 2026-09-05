import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state, FAQ_CATEGORIES, $, esc, hi, fmt, fillCategorySelect, renderChips, openModal, closeModal, emptyState }
  from './core.js';

let items = [], filter = '전체', editId = null, unsub = null;

function setSync(ok) {
  $('syncDot').className = ok ? 'dot' : 'dot off';
  $('syncLabel').textContent = ok ? '실시간 연결됨' : '연결 오류';
}

export function subscribeFaq() {
  if (unsub) { unsub(); unsub = null; }
  if (!state.user) { items = []; render(); return; }
  unsub = onSnapshot(
    query(collection(db, 'qa_items'), orderBy('createdAt', 'desc')),
    snap => { items = snap.docs.map(d => ({ id: d.id, ...d.data() })); setSync(true); render(); },
    () => setSync(false)
  );
}

export function openFaqModal(id = null) {
  editId = id;
  const item = id ? items.find(i => i.id === id) : null;
  $('faqModalTitle').textContent = id ? 'Q&A 수정' : '새 Q&A 추가';
  $('fCategory').value = item?.category || FAQ_CATEGORIES[0];
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

function render() {
  const q = $('searchInput').value.trim().toLowerCase();
  const cats = FAQ_CATEGORIES.filter(c => items.some(i => i.category === c));
  const extra = [...new Set(items.map(i => i.category).filter(c => c && !FAQ_CATEGORIES.includes(c)))];
  renderChips($('faqFilters'), [...cats, ...extra], filter);

  let list = items;
  if (filter !== '전체') list = list.filter(i => i.category === filter);
  if (q) list = list.filter(i =>
    (i.question || '').toLowerCase().includes(q) ||
    (i.answer || '').toLowerCase().includes(q) ||
    (i.category || '').toLowerCase().includes(q));

  $('faqStats').textContent = `총 ${items.length}개 · 표시 ${list.length}개`;

  const el = $('faqList');
  if (!list.length) {
    el.innerHTML = emptyState(q ? '🔍' : '📋', q
      ? `'${esc(q)}'에 대한 결과가 없습니다.`
      : '아직 등록된 자주 묻는 질문이 없습니다.<br>궁금한 점은 질문 등록하기 탭에서 남겨주세요.');
    return;
  }
  el.innerHTML = list.map(i => `
    <div class="qa-item" data-id="${esc(i.id)}">
      <div class="qa-question" data-act="toggle">
        <div class="qa-q-mark">Q</div>
        <div class="qa-q-content">
          <div class="qa-q-text">${hi(i.question, q)}</div>
          <div class="qa-meta">
            ${i.category ? `<span class="qa-tag">${hi(i.category, q)}</span>` : ''}
            <span class="qa-date">${fmt(i.createdAt)}</span>
          </div>
        </div>
        <div class="qa-chevron">▾</div>
      </div>
      <div class="qa-answer">
        <span class="qa-a-mark">A</span><span class="qa-a-text">${hi(i.answer, q)}</span>
        ${state.isAdmin ? `<div class="qa-item-actions">
          <button class="btn-sm" data-act="edit">✏ 수정</button>
          <button class="btn-sm danger" data-act="delete">🗑 삭제</button>
        </div>` : ''}
      </div>
    </div>`).join('');
}

export function initFaq() {
  fillCategorySelect($('fCategory'), FAQ_CATEGORIES);
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
