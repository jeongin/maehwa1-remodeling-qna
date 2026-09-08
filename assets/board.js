import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state, BOARD_CATEGORIES, $, esc, fmt, fillCategorySelect, renderChips, openModal, closeModal, emptyState }
  from './core.js';

let posts = [], filter = '전체', editId = null, answerId = null;
let unsubs = [], buckets = { all: [], mine: [], open: [] };

const newest = (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
const isMine = p => p.authorUid === state.user?.uid;

function merge(key, snap) {
  buckets[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const seen = new Map();
  for (const p of [...buckets.all, ...buckets.mine, ...buckets.open]) seen.set(p.id, p);
  posts = [...seen.values()].sort(newest);
  render();
}

export function subscribeBoard() {
  unsubs.forEach(u => u());
  unsubs = [];
  posts = []; buckets = { all: [], mine: [], open: [] };
  if (!state.user) { render(); return; }

  const col = collection(db, 'questions');
  const onErr = err => {
    $('boardList').innerHTML = emptyState('⚠️', '목록을 불러오지 못했습니다.<br>' + esc(err.message));
  };

  if (state.isAdmin) {
    unsubs.push(onSnapshot(query(col, orderBy('createdAt', 'desc')), s => merge('all', s), onErr));
  } else {
    // 규칙이 조회 범위를 강제한다. 내 질문과, 답변이 달린 공개 질문을 따로 구독해 합친다.
    unsubs.push(onSnapshot(query(col, where('authorUid', '==', state.user.uid)), s => merge('mine', s), onErr));
    unsubs.push(onSnapshot(
      query(col, where('isPublic', '==', true), where('status', '==', 'answered')),
      s => merge('open', s), onErr));
  }
}

export function openPostModal(id = null) {
  editId = id;
  const p = id ? posts.find(x => x.id === id) : null;
  $('postModalTitle').textContent = id ? '질문 수정' : '질문 작성';
  $('pCategory').value = p?.category || BOARD_CATEGORIES[0];
  $('pTitle').value = p?.title || '';
  $('pContent').value = p?.content || '';
  $('pPublic').value = p?.isPublic ? 'public' : 'private';
  $('pAuthorGroup').hidden = !state.isAdmin;
  $('pAnswerGroup').hidden = !state.isAdmin;
  $('pDong').value = p?.authorDong || '';
  $('pHo').value = p?.authorHo || '';
  $('pAnswer').value = p?.answer || '';
  openModal('postModal');
  setTimeout(() => $('pTitle').focus(), 100);
}

async function savePost() {
  const category = $('pCategory').value;
  const title = $('pTitle').value.trim();
  const content = $('pContent').value.trim();
  if (!title || !content) { alert('제목과 질문 내용을 모두 입력해주세요.'); return; }
  const adm = state.isAdmin;
  const isPublic = $('pPublic').value === 'public';
  const answer = adm ? $('pAnswer').value.trim() : '';
  const btn = $('postSaveBtn');
  btn.disabled = true;
  try {
    if (editId) {
      const patch = { category, title, content, isPublic, updatedAt: serverTimestamp() };
      if (adm) {
        patch.answer = answer;
        patch.status = answer ? 'answered' : 'pending';
        patch.authorDong = $('pDong').value.trim();
        patch.authorHo = $('pHo').value.trim();
      }
      await updateDoc(doc(db, 'questions', editId), patch);
    } else {
      await addDoc(collection(db, 'questions'), {
        category, title, content, isPublic,
        authorUid: state.user.uid,
        authorDong: adm ? $('pDong').value.trim() : state.dong,
        authorHo: adm ? $('pHo').value.trim() : state.ho,
        answer, status: answer ? 'answered' : 'pending',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
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
  const mine = isMine(p);
  const canEdit = state.isAdmin || mine;
  // 공개로 두어도 답변 전에는 작성자와 조합만 본다.
  const live = p.isPublic && answered;
  return `
    <div class="qa-item" data-id="${esc(p.id)}">
      <div class="qa-question" data-act="toggle">
        <div class="qa-q-mark">Q</div>
        <div class="qa-q-content">
          <div class="qa-q-text">${esc(p.title)}</div>
          <div class="qa-meta">
            <span class="qa-tag">${esc(p.category)}</span>
            <span class="status ${live ? 'open' : 'closed'}">${live ? '공개중' : p.isPublic ? '공개(답변 대기)' : '비공개'}</span>
            <span class="status ${answered ? 'answered' : 'pending'}">${answered ? '답변완료' : '답변대기'}</span>
            ${state.isAdmin ? `<span class="qa-author">${p.authorDong && p.authorHo
              ? `${esc(p.authorDong)}동 ${esc(p.authorHo)}호` : '조합 등록'}</span>` : ''}
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
          : `<div class="qa-pending">아직 답변이 등록되지 않았습니다.</div>`}
        <div class="qa-item-actions">
          ${state.isAdmin ? `<button class="btn-sm" data-act="answer">💬 ${answered ? '답변 수정' : '답변 등록'}</button>
          <button class="btn-sm" data-act="visibility">${p.isPublic ? '🔒 비공개로' : '🌐 공개로'}</button>
          <button class="btn-sm" data-act="edit">✏ 질문 수정</button>` : ''}
          ${!state.isAdmin && mine && !answered ? `<button class="btn-sm" data-act="edit">✏ 수정</button>` : ''}
          ${canEdit ? `<button class="btn-sm danger" data-act="delete">🗑 삭제</button>` : ''}
        </div>
      </div>
    </div>`;
}

function render() {
  renderChips($('boardFilters'), BOARD_CATEGORIES, filter);
  $('boardNotice').innerHTML = state.isAdmin
    ? '🔑 <strong>관리자 화면</strong> — 모든 질문이 보입니다. 공개로 설정된 질문은 <strong>답변을 등록하는 순간</strong> 다른 조합원에게도 공개됩니다.'
    : '🔒 질문은 기본적으로 <strong>나와 조합만</strong> 봅니다. <strong>공개</strong>로 올리면 조합이 답변을 등록한 뒤 다른 조합원도 질문과 답변을 볼 수 있습니다.';

  const list = filter === '전체' ? posts : posts.filter(p => p.category === filter);
  if (state.isAdmin) {
    const pending = posts.filter(p => !p.answer).length;
    $('boardStats').textContent = `전체 ${posts.length}건 · 답변대기 ${pending}건 · 표시 ${list.length}건`;
  } else {
    const mineCount = posts.filter(isMine).length;
    $('boardStats').textContent =
      `내 질문 ${mineCount}건 · 공개 Q&A ${posts.length - mineCount}건 · 표시 ${list.length}건`;
  }

  $('boardList').innerHTML = list.length
    ? list.map(card).join('')
    : emptyState('✍️', state.isAdmin
      ? '아직 접수된 질문이 없습니다.'
      : '아직 등록된 질문이 없습니다.<br>오른쪽 아래 ＋ 버튼으로 질문을 남겨주세요.');
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
    if (act === 'visibility') {
      const p = posts.find(x => x.id === id);
      try { await updateDoc(doc(db, 'questions', id), { isPublic: !p.isPublic, updatedAt: serverTimestamp() }); }
      catch (err) { alert('변경 오류: ' + err.message); }
    }
    if (act === 'delete' && confirm('이 질문을 삭제하시겠습니까?')) {
      try { await deleteDoc(doc(db, 'questions', id)); }
      catch (err) { alert('삭제 오류: ' + err.message); }
    }
  });
}
