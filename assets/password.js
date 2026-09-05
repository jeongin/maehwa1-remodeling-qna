import { updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, $, PW_PREFIX, openModal, closeModal } from './core.js';

/** forced = 첫 입장이라 변경 전에는 이용할 수 없는 상태 */
export function openPwModal(forced) {
  const modal = $('pwModal');
  modal.dataset.locked = forced ? '1' : '';
  $('pwModalTitle').textContent = forced ? '비밀번호 변경 (필수)' : '비밀번호 변경';
  $('pwNote').innerHTML = forced
    ? '🔐 첫 입장입니다. 휴대폰 뒷자리는 다른 사람이 추측하기 쉬우므로 <strong>비밀번호를 변경해야</strong> 이용하실 수 있습니다.'
    : '🔐 다음 입장부터 동·호수와 새 비밀번호로 로그인합니다.';
  $('pwCancel').hidden = forced;
  $('pwNew').value = '';
  $('pwNew2').value = '';
  $('pwError').textContent = '';
  openModal('pwModal');
  setTimeout(() => $('pwNew').focus(), 100);
}

async function save() {
  const a = $('pwNew').value;
  const b = $('pwNew2').value;
  const err = $('pwError');
  const btn = $('pwSaveBtn');

  if (a.length < 6) { err.textContent = '비밀번호는 6자 이상이어야 합니다.'; return; }
  if (a !== b) { err.textContent = '두 비밀번호가 일치하지 않습니다.'; return; }

  err.textContent = '';
  btn.disabled = true;
  try {
    await updatePassword(auth.currentUser, PW_PREFIX + a);
    await setDoc(doc(db, 'users', auth.currentUser.uid), { pwChanged: true }, { merge: true });
    $('pwModal').dataset.locked = '';
    closeModal('pwModal');
    alert('비밀번호가 변경되었습니다. 다음 입장부터 새 비밀번호를 사용하세요.');
  } catch (e) {
    err.textContent = e.code === 'auth/requires-recent-login'
      ? '보안을 위해 로그아웃 후 다시 입장한 뒤 변경해주세요.'
      : '변경 오류: ' + e.message;
  }
  btn.disabled = false;
}

export function initPassword() {
  $('pwSaveBtn').addEventListener('click', save);
  $('pwBtn').addEventListener('click', () => openPwModal(false));
  $('pwNew2').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
}
