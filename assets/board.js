import { collection, query, where, orderBy, onSnapshot, setDoc, updateDoc, deleteDoc, doc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state, CATEGORIES, $, esc, fmtAt, fillCategorySelect, renderChips, openModal, closeModal, emptyState }
  from './core.js';
import { renderSuggestions, initSuggestions } from './knowledge.js';
import { createAttachField, renderRichText } from './attach.js';

let posts = [], filter = '전체', statusFilter = '전체';
let editId = null, answerId = null, linkedId = null, draftId = null;
let answerAttach = null;
let unsubs = [], buckets = { all: [], mine: [] };

/** 관리자 전용 답변 상태 필터 */
const STATUS_TABS = ['답변대기', '답변완료'];

const SUG_FOOT = '찾는 답이 없으면 아래에서 질문을 이어서 작성하세요.';

const newest = (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
const isMine = p => p.authorUid === state.user?.uid;

function merge(key, snap) {
  buckets[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const seen = new Map();
  for (const p of [...buckets.all, ...buckets.mine]) seen.set(p.id, p);
  posts = [...seen.values()].sort(newest);
  render();
}

export function subscribeBoard() {
  unsubs.forEach(u => u());
  unsubs = [];
  posts = []; buckets = { all: [], mine: [] };
  if (!state.user) { render(); return; }

  const col = collection(db, 'questions');
  const onErr = err => {
    $('boardList').innerHTML = emptyState('⚠️', '목록을 불러오지 못했습니다.<br>' + esc(err.message));
  };

  if (state.isAdmin) {
    unsubs.push(onSnapshot(query(col, orderBy('createdAt', 'desc')), s => merge('all', s), onErr));
  } else {
    // 이 탭은 내가 올린 질문만 본다. 공개된 남의 Q&A 는 찾기 탭에서 검색한다.
    unsubs.push(onSnapshot(query(col, where('authorUid', '==', state.user.uid)), s => merge('mine', s), onErr));
  }
}

export function openPostModal(id = null) {
  editId = id;
  const p = id ? posts.find(x => x.id === id) : null;
  $('postModalTitle').textContent = id ? '질문 수정' : '질문 작성';
  $('pCategory').value = p?.category || CATEGORIES[0];
  $('pTitle').value = p?.title || '';
  $('pContent').value = p?.content || '';
  $('pPublic').value = p?.isPublic ? 'public' : 'private';
  $('pAuthorGroup').hidden = !state.isAdmin;
  $('pAnswerGroup').hidden = !state.isAdmin;
  $('pDong').value = p?.authorDong || '';
  $('pHo').value = p?.authorHo || '';
  $('pAnswer').value = p?.answer || '';
  renderSuggestions($('pSuggest'), $('pTitle').value, { excludeId: id, foot: SUG_FOOT });
  draftId = id || doc(collection(db, 'questions')).id;
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
        if (answer) patch.answeredAt = serverTimestamp();
        patch.authorDong = $('pDong').value.trim();
        patch.authorHo = $('pHo').value.trim();
      }
      await updateDoc(doc(db, 'questions', editId), patch);
    } else {
      await setDoc(doc(db, 'questions', draftId), {
        category, title, content, isPublic,
        authorUid: state.user.uid,
        authorDong: adm ? $('pDong').value.trim() : state.dong,
        authorHo: adm ? $('pHo').value.trim() : state.ho,
        answer, status: answer ? 'answered' : 'pending',
        ...(answer ? { answeredAt: serverTimestamp() } : {}),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    }
    closeModal('postModal');
  } catch (e) { alert('저장 오류: ' + e.message); }
  btn.disabled = false;
}

function openAnswerModal(id) {
  answerId = id;
  linkedId = null;
  const p = posts.find(x => x.id === id);
  $('answerQuote').textContent = `[${p.category}] ${p.title}\n\n${p.content}`;
  $('aContent').value = p.answer || '';
  $('aToFaq').checked = !!p.isFaq;
  $('aLinked').hidden = true;
  answerAttach.reset(p.answerImages, id);
  renderSuggestions($('aSuggest'), `${p.title} ${p.content}`, {
    excludeId: id,
    head: '이미 답변한 비슷한 질문이 있어요',
    pickLabel: '이 답변 연결',
    foot: '연결하면 그 답변을 그대로 가져옵니다. 새로 쓰시려면 무시하세요.'
  });
  openModal('answerModal');
  setTimeout(() => $('aContent').focus(), 100);
}

async function saveAnswer() {
  const answer = $('aContent').value.trim();
  const p = posts.find(x => x.id === answerId);
  const btn = $('answerSaveBtn');
  btn.disabled = true;
  try {
    await updateDoc(doc(db, 'questions', answerId), {
      answer, status: answer ? 'answered' : 'pending',
      answerImages: answerAttach.items(),
      // 복사본을 만들지 않고 이 질문에 표시만 단다. 목록에 두 번 뜨지 않는다.
      isFaq: !!answer && $('aToFaq').checked,
      answeredAt: serverTimestamp(),
      ...(linkedId ? { linkedId } : {})
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
            <span class="qa-author">${p.authorDong && p.authorHo
              ? `${esc(p.authorDong)}동 ${esc(p.authorHo)}호` : '조합 등록'}</span>
            <span class="qa-date">${fmtAt(p.createdAt)}</span>
          </div>
        </div>
        <div class="qa-chevron">▾</div>
      </div>
      <div class="qa-answer">
        <div class="qa-body">${esc(p.content)}</div>
        <div class="qa-divider"></div>
        ${answered
          ? `<span class="qa-a-mark">A</span><span class="qa-a-text">${renderRichText(p.answer, p.answerImages)}</span>
             ${p.answeredAt ? `<div class="qa-stamp">답변 ${fmtAt(p.answeredAt)}</div>` : ''}`
          : `<div class="qa-pending">아직 답변이 등록되지 않았습니다.</div>`}
        <div class="qa-item-actions">
          ${state.isAdmin ? `<button class="btn-sm" data-act="answer">💬 ${answered ? '답변 수정' : '답변 등록'}</button>
          <button class="btn-sm" data-act="visibility">${p.isPublic ? '🔒 비공개로' : '🌐 공개로'}</button>
          <button class="btn-sm" data-act="faq">${p.isFaq ? '☆ 자주 묻는 질문 해제' : '⭐ 자주 묻는 질문으로'}</button>
          <button class="btn-sm" data-act="edit">✏ 질문 수정</button>` : ''}
          ${!state.isAdmin && mine && !answered ? `<button class="btn-sm" data-act="edit">✏ 수정</button>` : ''}
          ${canEdit ? `<button class="btn-sm danger" data-act="delete">🗑 삭제</button>` : ''}
        </div>
      </div>
    </div>`;
}

function render() {
  renderChips($('boardFilters'), CATEGORIES, filter);
  $('boardNotice').innerHTML = state.isAdmin
    ? '🔑 <strong>관리자 화면</strong> — 모든 질문이 보입니다. 공개로 설정된 질문은 <strong>답변을 등록하는 순간</strong> 다른 조합원에게도 공개됩니다.'
    : '🔒 여기에는 <strong>내가 올린 질문만</strong> 보입니다. <strong>공개</strong>로 올린 질문은 조합이 답변을 등록한 뒤 <strong>기존 질문/답변 찾기</strong> 탭에서 다른 조합원도 보게 됩니다.';

  $('boardStatus').hidden = !state.isAdmin;
  if (state.isAdmin) renderChips($('boardStatus'), STATUS_TABS, statusFilter);

  let list = posts;
  if (statusFilter === '답변대기') list = list.filter(p => !p.answer);
  if (statusFilter === '답변완료') list = list.filter(p => p.answer);
  if (filter !== '전체') list = list.filter(p => p.category === filter);
  if (state.isAdmin) {
    const pending = posts.filter(p => !p.answer).length;
    $('boardStats').textContent = `전체 ${posts.length}건 · 답변대기 ${pending}건 · 표시 ${list.length}건`;
  } else {
    $('boardStats').textContent = `내 질문 ${posts.length}건 · 표시 ${list.length}건`;
  }

  $('boardList').innerHTML = list.length
    ? list.map(card).join('')
    : emptyState('✍️', state.isAdmin
      ? '아직 접수된 질문이 없습니다.'
      : '아직 등록하신 질문이 없습니다.<br>오른쪽 아래 ＋ 버튼으로 질문을 남겨주세요.');
}

export function initBoard() {
  fillCategorySelect($('pCategory'), CATEGORIES);
  answerAttach = createAttachField({ listId: 'aThumbs', inputId: 'aFile', pasteId: 'aContent', statusId: 'aAttachStatus' });
  initSuggestions($('pSuggest'));
  initSuggestions($('aSuggest'), hit => {
    $('aContent').value = hit.answer;
    linkedId = hit.id;
    $('aToFaq').checked = false;
    $('aLinked').hidden = false;
    $('aLinked').textContent = `🔗 기존 답변을 연결했습니다 — ${hit.question}`;
  });
  let timer = null;
  $('pTitle').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => renderSuggestions($('pSuggest'), $('pTitle').value,
      { excludeId: editId, foot: SUG_FOOT }), 250);
  });
  $('postSaveBtn').addEventListener('click', savePost);
  $('answerSaveBtn').addEventListener('click', saveAnswer);
  $('boardFilters').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) { filter = chip.dataset.cat; render(); }
  });
  $('boardStatus').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) { statusFilter = chip.dataset.cat; render(); }
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
    if (act === 'faq') {
      const p = posts.find(x => x.id === id);
      try { await updateDoc(doc(db, 'questions', id), { isFaq: !p.isFaq, updatedAt: serverTimestamp() }); }
      catch (err) { alert('변경 오류: ' + err.message); }
    }
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
