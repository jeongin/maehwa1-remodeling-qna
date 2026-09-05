import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut, deleteUser }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, doc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state, firebaseConfig, RESIDENT_DOMAIN, PW_PREFIX, $, esc, fmt } from './core.js';

// 계정을 만들면 그 계정으로 로그인되어 버린다. 보조 앱에서 만들어
// 관리자의 현재 세션이 끊기지 않게 한다.
let worker = null;
function workerAuth() {
  if (!worker) worker = getAuth(initializeApp(firebaseConfig, 'resident-writer'));
  return worker;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('내용이 비어 있습니다.');
  if (/dong|동/i.test(lines[0]) && !/^\d/.test(lines[0])) lines.shift();
  return lines.map((line, i) => {
    const [dong, ho, password] = line.split(/[,\t]/).map(v => (v || '').trim());
    if (!/^\d{1,5}$/.test(dong || '') || !/^\d{1,5}$/.test(ho || '') || !password || password.length < 4) {
      throw new Error(`${i + 1}번째 줄 형식 오류: "${line}"\n동,호수,비밀번호(4자 이상) 순서로 입력해주세요.`);
    }
    return { dong, ho, password };
  });
}

function readInput() {
  const text = $('csvText').value.trim();
  if (text) return Promise.resolve(text);
  const file = $('csvFile').files[0];
  if (!file) return Promise.reject(new Error('CSV 파일을 선택하거나 내용을 붙여넣어주세요.'));
  return file.text();
}

const log = html => { $('csvLog').innerHTML = html; };

async function check() {
  try {
    const rows = parseCsv(await readInput());
    log(`<span class="ok">✓ ${rows.length}세대 확인. 형식 이상 없습니다.</span>`);
  } catch (e) {
    log(`<span class="bad">✕ ${esc(e.message)}</span>`);
  }
}

async function run() {
  let rows;
  try {
    rows = parseCsv(await readInput());
  } catch (e) {
    log(`<span class="bad">✕ ${esc(e.message)}</span>`);
    return;
  }
  if (!confirm(`${rows.length}세대의 계정을 등록합니다. 진행할까요?`)) return;

  const btn = $('csvRunBtn');
  btn.disabled = true;
  const wa = workerAuth();
  let created = 0, exists = 0;
  const failures = [];

  for (let i = 0; i < rows.length; i++) {
    const { dong, ho, password } = rows[i];
    log(`등록 중... ${i + 1} / ${rows.length}<br>신규 ${created} · 기존 ${exists} · 실패 ${failures.length}`);
    try {
      const cred = await createUserWithEmailAndPassword(
        wa, `${dong}-${ho}@${RESIDENT_DOMAIN}`, PW_PREFIX + password);
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          dong, ho, pwChanged: false, createdAt: serverTimestamp()
        });
      } catch (e2) {
        // 명부 없는 계정은 아무것도 못 하므로 계정째 되돌린다.
        await deleteUser(cred.user).catch(() => {});
        throw e2;
      }
      created++;
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') exists++;
      else failures.push(`${dong}동 ${ho}호 — ${e.code || e.message}`);
    }
  }
  await signOut(wa).catch(() => {});

  log(`<span class="ok">완료 — 신규 ${created}세대, 이미 등록됨 ${exists}세대, 실패 ${failures.length}세대</span>`
    + (exists ? `<div class="note">이미 있는 세대는 건너뛰었습니다. 비밀번호를 초기화하려면 Firebase 콘솔에서 계정을 삭제한 뒤 다시 올려주세요.</div>` : '')
    + (failures.length ? `<div class="bad">${failures.map(esc).join('<br>')}</div>` : ''));
  btn.disabled = false;
  loadRoster();
}

let roster = [];

export async function loadRoster() {
  if (!state.isAdmin) return;
  try {
    const snap = await getDocs(collection(db, 'users'));
    roster = snap.docs.map(d => d.data())
      .sort((a, b) => (+a.dong - +b.dong) || (+a.ho - +b.ho));
  } catch (e) {
    roster = [];
    $('rosterStats').textContent = '명부를 불러오지 못했습니다: ' + e.message;
    return;
  }
  renderRoster();
}

function renderRoster() {
  const q = $('rosterSearch').value.trim();
  const list = q ? roster.filter(r => `${r.dong}-${r.ho}`.includes(q)) : roster;
  const pending = roster.filter(r => r.pwChanged !== true).length;
  $('rosterStats').textContent =
    `등록 ${roster.length}세대 · 비밀번호 미변경 ${pending}세대 · 표시 ${list.length}세대`;
  $('rosterList').innerHTML = list.length
    ? list.map(r => `<div class="roster-row">
        <span class="roster-unit">${esc(r.dong)}동 ${esc(r.ho)}호</span>
        <span class="status ${r.pwChanged ? 'answered' : 'pending'}">${r.pwChanged ? '변경완료' : '초기 비번'}</span>
        <span class="qa-date">${fmt(r.createdAt)}</span>
      </div>`).join('')
    : `<div class="empty-state"><p>표시할 세대가 없습니다.</p></div>`;
}

export function initAdmin() {
  $('csvCheckBtn').addEventListener('click', check);
  $('csvRunBtn').addEventListener('click', run);
  $('rosterSearch').addEventListener('input', renderRoster);
}
