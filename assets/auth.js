import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth, state, RESIDENT_DOMAIN, PW_PREFIX, $ } from './core.js';
import { openPwModal } from './password.js';

const residentEmail = (dong, ho) => `${dong}-${ho}@${RESIDENT_DOMAIN}`;

/** 조합원 계정 이메일에서 동·호수를 되읽는다. */
function parseResident(email) {
  if (!email || !email.endsWith('@' + RESIDENT_DOMAIN)) return null;
  const [dong, ho] = email.split('@')[0].split('-');
  return dong && ho ? { dong, ho } : null;
}

function setBusy(btn, busy, label) {
  btn.disabled = busy;
  btn.textContent = busy ? '처리 중...' : label;
}

async function residentLogin() {
  const dong = $('gDong').value.trim();
  const ho = $('gHo').value.trim();
  const typed = $('gPw').value;
  const err = $('gateError');
  const btn = $('gBtn');

  if (!/^\d{1,5}$/.test(dong) || !/^\d{1,5}$/.test(ho)) {
    err.textContent = '동과 호수를 숫자로 입력해주세요. (예: 101동 1503호)'; return;
  }
  if (typed.length < 4) {
    err.textContent = '비밀번호를 입력해주세요. (첫 입장은 휴대폰 뒷 4자리)'; return;
  }

  err.textContent = '';
  setBusy(btn, true, '입장하기');
  const email = residentEmail(dong, ho);
  const pw = PW_PREFIX + typed;

  try {
    await signInWithEmailAndPassword(auth, email, pw);
  } catch (e) {
    if (['auth/user-not-found', 'auth/invalid-credential', 'auth/wrong-password'].includes(e.code)) {
      if (!/^\d{4}$/.test(typed)) {
        err.textContent = '비밀번호가 올바르지 않습니다.';
        setBusy(btn, false, '입장하기');
        return;
      }
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        // 동·호수 명부 기록은 부가 기능이므로, 실패해도 입장을 막지 않는다.
        try {
          await setDoc(doc(db, 'users', cred.user.uid), {
            dong, ho, pwChanged: false, createdAt: serverTimestamp()
          }, { merge: true });
        } catch (e3) {
          console.warn('명부 기록 실패 (입장은 계속):', e3.code || e3.message);
        }
      } catch (e2) {
        err.textContent =
          e2.code === 'auth/email-already-in-use'
            ? `${dong}동 ${ho}호는 이미 등록되어 있습니다.\n휴대폰 뒷자리를 다시 확인해주세요.`
            : e2.code === 'auth/operation-not-allowed'
              ? 'Firebase 콘솔에서 이메일/비밀번호 로그인을 활성화해주세요.'
              : '입장 오류: ' + e2.message;
        setBusy(btn, false, '입장하기');
      }
    } else {
      err.textContent = e.code === 'auth/too-many-requests'
        ? '시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.'
        : '입장 오류: ' + e.message;
      setBusy(btn, false, '입장하기');
    }
  }
}

async function adminLogin() {
  const email = $('aEmail').value.trim();
  const pw = $('aPw').value;
  const err = $('adminError');
  const btn = $('aBtn');
  if (!email || !pw) { err.textContent = '이메일과 비밀번호를 입력해주세요.'; return; }
  err.textContent = '';
  setBusy(btn, true, '관리자 로그인');
  try {
    await signInWithEmailAndPassword(auth, email, pw);
  } catch (e) {
    err.textContent = e.code === 'auth/invalid-credential'
      ? '이메일 또는 비밀번호가 올바르지 않습니다.'
      : e.code === 'auth/too-many-requests'
        ? '시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.'
        : '로그인 오류: ' + e.message;
    setBusy(btn, false, '관리자 로그인');
  }
}

function showGate(showAdmin) {
  $('residentForm').hidden = showAdmin;
  $('adminForm').hidden = !showAdmin;
  $('gateError').textContent = '';
  $('adminError').textContent = '';
}

/** 로그인 상태가 바뀔 때마다 onChange(signedIn) 를 호출한다. */
export function initAuth(onChange) {
  $('gBtn').addEventListener('click', residentLogin);
  $('aBtn').addEventListener('click', adminLogin);
  $('toAdmin').addEventListener('click', () => showGate(true));
  $('toResident').addEventListener('click', () => showGate(false));
  $('gPw').addEventListener('keydown', e => { if (e.key === 'Enter') residentLogin(); });
  $('aPw').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
  $('logoutBtn').addEventListener('click', async () => {
    if (confirm('로그아웃 하시겠습니까?')) await signOut(auth);
  });

  onAuthStateChanged(auth, async user => {
    state.user = user;
    $('bootScreen').hidden = true;
    if (!user) {
      state.isAdmin = false; state.dong = ''; state.ho = '';
      $('gateScreen').style.display = 'flex';
      setBusy($('gBtn'), false, '입장하기');
      setBusy($('aBtn'), false, '관리자 로그인');
      $('gPw').value = '';
      $('aPw').value = '';
      $('roleBadge').hidden = true;
      $('pwBtn').hidden = true;
      onChange(false);
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'config', 'admins'));
      state.isAdmin = snap.exists() && (snap.data().emails || []).includes(user.email);
    } catch { state.isAdmin = false; }

    const who = parseResident(user.email);
    state.dong = who?.dong || '';
    state.ho = who?.ho || '';

    const badge = $('roleBadge');
    badge.hidden = false;
    badge.textContent = state.isAdmin ? '관리자' : `${state.dong}동 ${state.ho}호`;
    badge.className = `role-badge ${state.isAdmin ? 'admin' : 'member'}`;

    $('gateScreen').style.display = 'none';
    $('pwBtn').hidden = !who;
    onChange(true);

    // 동·호수 계정은 관리자 여부와 무관하게 최초 비밀번호를 바꿔야 한다.
    // 관리자 권한 계정이 휴대폰 뒷 4자리로 남아 있는 편이 더 위험하다.
    if (who) {
      try {
        const prof = await getDoc(doc(db, 'users', user.uid));
        if (!prof.exists() || prof.data().pwChanged !== true) openPwModal(true);
      } catch (e) {
        console.warn('비밀번호 변경 여부 확인 실패:', e.code || e.message);
      }
    }
  });
}
