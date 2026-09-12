// ===================================================
// 우리 반 담벼락 - Firestore 연동
//
// 메모를 쓰면 Firestore에 저장되고, 실시간으로 담벼락에 붙습니다.
// ===================================================

// Firebase SDK를 CDN ES Module 방식으로 가져옵니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Firebase 설정값
const firebaseConfig = {
  apiKey: "AIzaSyBR92kzmyOkbHHt3GDFSM-2d3KUOcHSzGY",
  authDomain: "test-wall-7df8a.firebaseapp.com",
  projectId: "test-wall-7df8a",
  storageBucket: "test-wall-7df8a.firebasestorage.app",
  messagingSenderId: "848937312042",
  appId: "1:848937312042:web:c6aaf1d0b348b852b2c853"
};

// Firebase 앱과 Firestore 데이터베이스를 시작합니다.
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Firestore 안의 "memos" 컬렉션을 가리킵니다.
const memosCol = collection(db, "memos");


// ===================================================
// 데이터를 다루는 함수 세 개 (Firestore 연동)
// ===================================================

// 메모를 읽어 옵니다.
// Firestore 실시간 리스너(onSnapshot)를 설정합니다.
// 메모가 추가·삭제될 때마다 render()가 자동으로 호출됩니다.
function loadMemos() {
  const q = query(memosCol, orderBy("createdAt"));
  onSnapshot(q, function (snapshot) {
    const memos = snapshot.docs.map(function (docSnap) {
      return { id: docSnap.id, ...docSnap.data() };
    });
    render(memos);
  });
}

// 메모를 새로 씁니다.
// Firestore의 "memos" 컬렉션에 문서를 추가합니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  await addDoc(memosCol, {
    text: text,
    createdAt: Date.now()
  });
}

// 메모를 지웁니다.
// id는 Firestore 문서 ID(문자열)입니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 화면 그리기
// ===================================================

// memos: loadMemos()의 onSnapshot 콜백에서 전달받는 메모 배열
function render(memos) {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  const del = document.createElement("button");
  del.textContent = "×";
  // Firestore 연동 후 render()는 onSnapshot이 자동 호출하므로 별도 호출 불필요
  del.addEventListener("click", function () {
    deleteMemo(memo.id);
  });
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");
const hint  = document.getElementById("hint");   // 글자 수 안내 문구

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    // 5글자 미만이면 저장하지 않고 안내 문구를 보여줍니다.
    // Firestore 보안 규칙에서도 동일하게 막으므로 이중으로 적용됩니다.
    if (text.length < 5) {
      hint.textContent = "⚠️ 메모는 5글자 이상 써야 저장됩니다.";
      hint.hidden = false;
      return;
    }

    hint.hidden = true;

    try {
      // addMemo가 async이므로 저장이 끝날 때까지 기다립니다.
      // 저장에 성공한 뒤에만 입력창을 비웁니다.
      await addMemo(text);
      input.value = "";
    } catch (err) {
      // 저장 실패 시 글은 그대로 두고 오류 안내를 표시합니다.
      hint.textContent = "⚠️ 저장에 실패했습니다. 다시 시도해 주세요.";
      hint.hidden = false;
      console.error("Firestore 저장 오류:", err);
    }
  }
});


// 실시간 리스너를 시작합니다. 이후 화면 그리기는 onSnapshot이 자동으로 처리합니다.
loadMemos();
input.focus();
