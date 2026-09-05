import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state, BOARD_CATEGORIES, $, esc, fmt, fillCategorySelect, renderChips, openModal, closeModal, emptyState }
  from './core.js';

let posts = [], filter = '전체', editId = null, answerId = null, unsub = null;

const newest = (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);

export function subscribeBoard() {
  if (unsub) { unsub(); unsub = null; }
  posts = [];
  if (!state.user) { render(); return; }
  const col = collection(db, 'questions');
  // 조합원은 보안 규칙상 본인 글만 읽을 수 있으므로 authorUid 로 좁혀서 조회한다.
  const q = state.isAdmin
    ? query(col, orderBy('createdAt', 'desc'))
    : query(col, where('authorUid', '==', state.user.uid));
  unsub = onSnapshot(q,
    snap => { posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(newest); render(); },
    err => { $('boardList').innerHTML = emptyState('⚠️', '목록을 불러오지 못했습니다.<br>' + esc(err.message)); }
  );
}

export function openPostModal(id = null) {
  editId = id;
  const p = id ? posts.find(x => x.id === id) : null;
  $('postModalTitle').textContent = id ? '질문 수정' : '질문 작성';
  $('pCategory').value = p?.category || BOARD_CATEGORIES[0];
  $('pTitle').value = p?.title || '';
  $('pContent').value = p?.content || '';
  openModal('postModal');
  setTimeout(() => $('pTitle').focus(), 100);
}

async function savePost() {
  const category = $('pCategory').value;
  const title = $('pTitle').value.trim();
  const content = $('pContent').value.trim();
  if (!title || !content) { alert('제목과 질문 내용을 모두 입력해주세요.'); return; }
  const btn = $('postSaveBtn');
  btn.disabled = true;
  try {
    if (editId) {
      await updateDoc(doc(db, 'questions', editId), { category, title, content, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'questions'), {
        category, title, content,
        authorUid: state.user.uid, authorDong: state.dong, authorHo: state.ho,
        answer: '', status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    }
    closeModal('postModal');
  } catch (e) { alert('저장 오류: ' + e.message); }
  btn.disabled = false;
}

function openAnswerModal(id) {
  answerId = id;
  const p = posts.find(x => x.id === id);
  $('answerQuote').textContent = `[${p.category}] ${p.title}\n\n${p.content}`;
  $('aContent').value = p.answer || '';
  openModal('answerModal');
  setTimeout(() => $('aContent').focus(), 100);
}

async function saveAnswer() {
  const answer = $('aContent').value.trim();
  const btn = $('answerSaveBtn');
  btn.disabled = true;
  try {
    await updateDoc(doc(db, 'questions', answerId), {
      answer, status: answer ? 'answered' : 'pending', answeredAt: serverTimestamp()
    });
    closeModal('answerModal');
  } catch (e) { alert('저장 오류: ' + e.message); }
  btn.disabled = false;
}

function card(p) {
  const answered = !!p.answer;
  const canEdit = state.isAdmin || p.authorUid === state.user?.uid;
  return `
    <div class="qa-item" data-id="${esc(p.id)}">
      <div class="qa-question" data-act="toggle">
        <div class="qa-q-mark">Q</div>
        <div class="qa-q-content">
          <div class="qa-q-text">${esc(p.title)}</div>
          <div class="qa-meta">
            <span class="qa-tag">${esc(p.category)}</span>
            <span class="status ${answered ? 'answered' : 'pending'}">${answered ? '답변완료' : '답변대기'}</span>
            ${state.isAdmin ? `<span class="qa-author">${esc(p.authorDong)}동 ${esc(p.authorHo)}호</span>` : ''}
            <span class="qa-date">${fmt(p.createdAt)}</span>
          </div>
        </div>
        <div class="qa-chevron">▾</div>
      </div>
      <div class="qa-answer">
        <div class="qa-body">${esc(p.content)}</div>
        <div class="qa-divider"></div>
        ${answered
          ? `<span class="qa-a-mark">A</span><span class="qa-a-text">${esc(p.answer)}</span>`
          : `<div class="qa-pending">아직 답변이 등록되지 않았습니다. 주민설명회에서 답변드릴 예정입니다.</div>`}
        <div class="qa-item-actions">
          ${state.isAdmin ? `<button class="btn-sm" data-act="answer">💬 ${answered ? '답변 수정' : '답변 등록'}</button>` : ''}
          ${!state.isAdmin && !answered ? `<button class="btn-sm" data-act="edit">✏ 수정</button>` : ''}
          ${canEdit ? `<button class="btn-sm danger" data-act="delete">🗑 삭제</button>` : ''}
        </div>
      </div>
    </div>`;
}

function render() {
  renderChips($('boardFilters'), BOARD_CATEGORIES, filter);
  $('boardNotice').innerHTML = state.isAdmin
    ? '🔑 <strong>관리자 화면</strong> — 조합원이 등록한 모든 질문과 작성자 동·호수가 표시됩니다.'
    : '🔒 질문 내용은 <strong>관리자와 작성자 본인만</strong> 볼 수 있습니다. 아래 목록에는 내가 등록한 질문만 표시됩니다.';

  const list = filter === '전체' ? posts : posts.filter(p => p.category === filter);
  const pending = posts.filter(p => !p.answer).length;
  $('boardStats').textContent = state.isAdmin
    ? `전체 ${posts.length}건 · 답변대기 ${pending}건 · 표시 ${list.length}건`
    : `내 질문 ${posts.length}건 · 표시 ${list.length}건`;

  const el = $('boardList');
  el.innerHTML = list.length
    ? list.map(card).join('')
    : emptyState('✍️', state.isAdmin
      ? '아직 접수된 질문이 없습니다.'
      : '아직 등록한 질문이 없습니다.<br>오른쪽 아래 ＋ 버튼으로 질문을 남겨주세요.');
}

export function initBoard() {
  fillCategorySelect($('pCategory'), BOARD_CATEGORIES);
  $('postSaveBtn').addEventListener('click', savePost);
  $('answerSaveBtn').addEventListener('click', saveAnswer);
  $('boardFilters').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) { filter = chip.dataset.cat; render(); }
  });
  $('boardList').addEventListener('click', async e => {
    const target = e.target.closest('[data-act]');
    const cardEl = e.target.closest('.qa-item');
    if (!target || !cardEl) return;
    const id = cardEl.dataset.id;
    const act = target.dataset.act;
    if (act === 'toggle') cardEl.classList.toggle('open');
    if (act === 'edit') openPostModal(id);
    if (act === 'answer') openAnswerModal(id);
    if (act === 'delete' && confirm('이 질문을 삭제하시겠습니까?')) {
      try { await deleteDoc(doc(db, 'questions', id)); }
      catch (err) { alert('삭제 오류: ' + err.message); }
    }
  });
}
