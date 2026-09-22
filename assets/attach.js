import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { app, $, esc, hi } from './core.js';
import { prepareImage, imagesFrom } from './image.js';

const storage = getStorage(app);
// 기본값(2분)은 너무 길어 실패가 한참 뒤에야 보인다. 짧게 잡아 바로 알려준다.
storage.maxUploadRetryTime = 15000;
storage.maxOperationRetryTime = 15000;
export const MAX_FILES = 5;

const MESSAGES = {
  'storage/unauthorized': '업로드 권한이 없습니다. Storage 보안 규칙을 확인해주세요.',
  'storage/unknown': 'Storage 가 아직 준비되지 않았습니다. Firebase 콘솔에서 Storage 를 시작해주세요.',
  'storage/retry-limit-exceeded': '업로드가 완료되지 않았습니다. Storage 가 켜져 있는지, 네트워크가 정상인지 확인해주세요.',
  'storage/canceled': '업로드가 취소되었습니다.',
  'storage/quota-exceeded': '저장 용량이 가득 찼습니다. 조합 사무실에 알려주세요.'
};
const message = e => MESSAGES[e.code] || e.message || '이미지를 올리지 못했습니다.';

const MARK = n => `[[이미지${n}]]`;
const MARK_RE = /\[\[이미지(\d+)\]\]/g;

/** 커서 자리에 마커를 끼워 넣는다. */
function insertAtCursor(el, text) {
  const a = el.selectionStart ?? el.value.length;
  const b = el.selectionEnd ?? a;
  const before = el.value.slice(0, a);
  const pad = before && !before.endsWith('\n') ? '\n' : '';
  el.value = before + pad + text + '\n' + el.value.slice(b);
  const pos = (before + pad + text + '\n').length;
  el.setSelectionRange(pos, pos);
  el.focus();
}

/** n 번 마커를 지우고 뒤 번호를 한 칸씩 당긴다. */
function dropMarker(el, n, total) {
  let v = el.value.split(MARK(n)).join('');
  for (let i = n + 1; i <= total; i++) v = v.split(MARK(i)).join(MARK(i - 1));
  el.value = v.replace(/\n{3,}/g, '\n\n');
}

const rand = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * 이미지 첨부 한 벌을 관리한다. 붙여넣기·드롭·파일선택을 모두 받아
 * 정해진 용량으로 줄인 뒤 Storage 에 올리고 썸네일을 그린다.
 */
export function createAttachField({ listId, inputId, pasteId, statusId }) {
  const listEl = $(listId), inputEl = $(inputId), statusEl = $(statusId), target = $(pasteId);
  let items = [];       // { url, path, width, height }
  let docId = null;
  let pending = 0;

  const say = (msg, bad) => {
    statusEl.textContent = msg || '';
    statusEl.className = 'attach-status' + (bad ? ' bad' : '');
  };

  function render() {
    listEl.innerHTML = items.map((it, i) => `
      <div class="thumb">
        <img src="${esc(it.url)}" alt="첨부 ${i + 1}">
        <button type="button" class="thumb-x" data-rm="${i}" title="삭제">✕</button>
      </div>`).join('');
  }

  async function add(files) {
    for (const file of files) {
      if (items.length + pending >= MAX_FILES) { say(`이미지는 최대 ${MAX_FILES}장까지 첨부할 수 있습니다.`, true); return; }
      pending++;
      say(`이미지 처리 중... (${items.length + pending}/${MAX_FILES})`);
      try {
        const { blob, width, height } = await prepareImage(file);
        const path = `attachments/${docId}/${rand()}.jpg`;
        const r = ref(storage, path);
        await uploadBytes(r, blob, { contentType: 'image/jpeg' });
        items.push({ url: await getDownloadURL(r), path, width, height });
        insertAtCursor(target, MARK(items.length));
        render();
        say(`${Math.round(blob.size / 1024)}KB 로 줄여 올렸습니다.`);
      } catch (e) {
        say(message(e), true);
      } finally { pending--; }
    }
  }

  listEl.addEventListener('click', async e => {
    const btn = e.target.closest('[data-rm]');
    if (!btn) return;
    const idx = Number(btn.dataset.rm);
    const it = items[idx];
    dropMarker(target, idx + 1, items.length);
    items.splice(idx, 1);
    render();
    try { await deleteObject(ref(storage, it.path)); } catch { /* 이미 없으면 그만 */ }
  });

  inputEl.addEventListener('change', () => {
    add([...inputEl.files].filter(f => f.type.startsWith('image/')));
    inputEl.value = '';
  });

  target.addEventListener('paste', e => {
    const files = imagesFrom(e.clipboardData);
    if (files.length) { e.preventDefault(); add(files); }
  });
  target.addEventListener('dragover', e => { e.preventDefault(); });
  target.addEventListener('drop', e => {
    const files = imagesFrom(e.dataTransfer);
    if (files.length) { e.preventDefault(); add(files); }
  });

  return {
    /** 모달을 열 때마다 대상 문서와 기존 첨부로 초기화한다. */
    reset(existing, id) {
      items = Array.isArray(existing) ? [...existing] : [];
      docId = id;
      pending = 0;
      render();
      say('');
    },
    items: () => items.map(({ url, path, width, height }) => ({ url, path, width, height })),
    busy: () => pending > 0
  };
}

// 태그 사이에 공백을 두면 pre-wrap 부모에서 그대로 여백으로 보인다. 붙여 쓴다.
const thumb = (img, cls) =>
  `<a class="${cls}" href="${esc(img.url)}" target="_blank" rel="noopener"` +
  `><img src="${esc(img.url)}" alt="첨부 이미지" loading="lazy"></a>`;

/**
 * 마커가 있는 자리에 이미지를 끼워 본문을 그린다.
 * 마커가 없는 이미지는 뒤에 모아 붙여 어떤 경우에도 빠지지 않게 한다.
 */
export function renderRichText(text, images = [], q = '') {
  const used = new Set();
  const parts = String(text || '').split(/(\[\[이미지\d+\]\])/g);
  const isMark = i => /^\[\[이미지\d+\]\]$/.test(parts[i] || '');
  const body = parts.map((part, i) => {
    const m = part.match(/^\[\[이미지(\d+)\]\]$/);
    if (!m) {
      // 이미지가 블록이라 바로 앞뒤 줄바꿈은 빈 줄로 겹쳐 보인다.
      let t = part;
      if (isMark(i - 1)) t = t.replace(/^\n/, '');
      if (isMark(i + 1)) t = t.replace(/\n$/, '');
      return hi(t, q);
    }
    const n = Number(m[1]);
    const img = images[n - 1];
    if (!img) return '';
    used.add(n);
    return thumb(img, 'att att-inline');
  }).join('');
  const rest = images.filter((_, i) => !used.has(i + 1));
  return body + (rest.length
    ? `<div class="att-row">${rest.map(i => thumb(i, 'att')).join('')}</div>` : '');
}
