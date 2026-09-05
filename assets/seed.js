import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state, $ } from './core.js';

/** 화면에 표시될 순서대로. 등록은 역순으로 넣어 최신순 정렬과 맞춘다. */
const ITEMS = [
  { category: '총회', question: '세대별 분담금 확인은 언제 가능한가요?',
    answer: '동호수별 분담금은 총회 책자로 확인하시면 됩니다.' },
  { category: '총회', question: '총회 책자는 어떻게 수령하나요?',
    answer: '총회 책자는 추석 전에 수령 가능하시도록 준비할 예정입니다.' },
  { category: '총회', question: '총회 책자에는 어떤 내용이 담기나요?',
    answer: '3년 전 200p가 넘는 두꺼운 책자를 생각하시면 됩니다. 세대별 분담금은 총회 책자에만 실을 예정이므로, 정확한 세대별 수치는 총회 책자를 확인하셔야 합니다.' },
  { category: '총회', question: '아직 잔금 이전입니다. 총회 책자를 받아볼 수 있나요?',
    answer: '입주 예정자의 경우 총회 당일 혹은 이후에 계약서를 지참하여 오시면 배부해 드리겠습니다.' },
  { category: '주민설명회', question: '주민설명회 당일 참석이 어렵습니다. 인터넷 중계나 내용 공개가 가능한가요?',
    answer: '설명회는 별도 중계 없이 9월 19일 현장에서 확인하셔야 합니다. 자료 공개는 인터넷에 공개되기 예민한 자료 일부를 제외하고 공개 여부를 검토하도록 하겠습니다.' },
  { category: '주민설명회', question: '이주 일정은 언제 알려주나요?',
    answer: '이주 계획은 주민설명회 때 함께 안내드릴 예정입니다.' },
  { category: '주민설명회', question: '주민설명회 책자는 어떻게 수령하나요?',
    answer: '1세대 1권으로 현장에서 배포할 예정입니다. 입주 예정자의 경우 행사 당일 계약서 등을 지참하여 오시면 배부해 드리겠습니다.\n\n설명회를 놓치신 분은 추후 조합에 방문하시면 확인 후 수령 가능하도록 준비하겠습니다.' },
  { category: '주민설명회', question: '주민설명회 책자에는 어떤 내용이 담기나요?',
    answer: '설명회 구성에 맞추어 핵심 콘텐츠만 담길 예정입니다. 타입별 평균값과 상승치를 안내하여 분담금을 대략 가늠하실 수 있으나, 세대별 정확한 수치는 총회 책자를 확인하셔야 합니다.' },
  { category: '주민설명회', question: '아직 잔금 이전입니다. 설명회 책자를 받아볼 수 있나요?',
    answer: '입주 예정자의 경우 설명회 당일 혹은 이후에 계약서를 지참하여 오시면 배부해 드리겠습니다.' }
];

async function run(btn, log) {
  if (!confirm(`기존 자주 묻는 질문을 모두 삭제하고 ${ITEMS.length}건을 새로 등록합니다. 진행할까요?`)) return;
  btn.disabled = true;
  try {
    const snap = await getDocs(collection(db, 'qa_items'));
    for (const d of snap.docs) await deleteDoc(doc(db, 'qa_items', d.id));
    log.textContent = `기존 ${snap.size}건 삭제 완료. 등록 중...`;
    for (const it of [...ITEMS].reverse()) {
      await addDoc(collection(db, 'qa_items'), { ...it, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    log.textContent = `완료 — 기존 ${snap.size}건 삭제, ${ITEMS.length}건 등록했습니다. 이 화면은 닫으셔도 됩니다.`;
  } catch (e) {
    log.textContent = '오류: ' + e.message;
    btn.disabled = false;
  }
}

/** ?seed=faq 로 접속한 관리자에게만 일괄 등록 패널을 띄운다. */
export function initSeed() {
  if (document.getElementById('seedPanel')) return;
  if (new URLSearchParams(location.search).get('seed') !== 'faq') return;
  if (!state.isAdmin) return;

  const box = document.createElement('div');
  box.id = 'seedPanel';
  box.className = 'notice';
  box.style.cssText = 'margin:16px auto;max-width:760px;border-color:var(--accent2)';
  box.innerHTML = `<strong>FAQ 일괄 등록</strong> — 기존 항목을 모두 지우고 ${ITEMS.length}건을 등록합니다.
    <div style="margin-top:10px"><button class="btn-primary" id="seedRun">실행</button></div>
    <div id="seedLog" style="margin-top:8px"></div>`;
  document.getElementById('panel-faq').prepend(box);
  document.getElementById('seedRun').addEventListener('click', e => run(e.target, document.getElementById('seedLog')));
}
