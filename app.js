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
  getDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

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

// 구글 로그인
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

// 지금 로그인한 사용자. 로그인 전에는 null입니다.
let currentUser = null;

// 지금 로그인한 사용자의 역할. "teacher" 또는 "student". 로그인 전에는 null입니다.
// roles/{uid} 문서의 role 필드로 정해지며, 문서가 없으면 학생으로 취급합니다.
// 이 문서는 학생이 직접 만들 수 없고(Firestore 규칙에서 막음), 선생님 계정은
// Firebase 콘솔의 Firestore에서 관리자가 직접 등록해야 합니다.
let currentRole = null;

// onSnapshot이 마지막으로 전달한 메모 목록.
// 역할이 바뀌었을 때(로그인/로그아웃) 담벼락을 다시 그리는 데 씁니다.
let lastMemos = [];


// ===================================================
// 로그인 / 로그아웃
// ===================================================

function login() {
  signInWithPopup(auth, provider).catch(function (err) {
    console.error("로그인 오류:", err);
  });
}

function logout() {
  signOut(auth);
}

// roles/{uid} 문서를 읽어서 "teacher" 또는 "student"를 돌려줍니다.
async function fetchRole(uid) {
  try {
    const snap = await getDoc(doc(db, "roles", uid));
    if (snap.exists() && snap.data().role === "teacher") {
      return "teacher";
    }
  } catch (err) {
    console.error("역할 조회 오류:", err);
  }
  return "student";
}

// 로그인 상태가 바뀔 때마다(로그인 성공, 로그아웃) 자동으로 호출됩니다.
onAuthStateChanged(auth, async function (user) {
  currentUser = user;
  currentRole = user ? await fetchRole(user.uid) : null;
  if (user) {
    // 디버그용: Firestore roles 문서의 ID와 정확히 같은지 비교해 보세요.
    console.log("로그인 uid:", user.uid, "/ 역할:", currentRole);
  }
  renderUserArea(user);
  render(lastMemos);
});

// 로그인 버튼 / 내 이름과 역할을 화면에 그립니다.
function renderUserArea(user) {
  const userArea = document.getElementById("userArea");
  userArea.innerHTML = "";

  if (user) {
    const roleLabel = currentRole === "teacher" ? "선생님" : "학생";

    const name = document.createElement("span");
    name.textContent = (user.displayName || "익명") + "님 (" + roleLabel + ")";
    userArea.appendChild(name);

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", logout);
    userArea.appendChild(logoutBtn);

    input.disabled = false;
    input.placeholder = "메모를 쓰고 엔터 (5글자 이상)";
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "구글로 로그인";
    loginBtn.addEventListener("click", login);
    userArea.appendChild(loginBtn);

    input.disabled = true;
    input.placeholder = "로그인 후 메모를 쓸 수 있습니다.";
  }
}


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
    lastMemos = memos;
    render(memos);
  });
}

// 메모를 새로 씁니다.
// Firestore의 "memos" 컬렉션에 문서를 추가합니다.
// 로그인한 사용자의 uid와 이름을 함께 저장해서 "누가 썼는지" 알 수 있습니다.
async function addMemo(text) {
  await addDoc(memosCol, {
    text: text,
    createdAt: Date.now(),
    uid: currentUser.uid,
    authorName: currentUser.displayName || "익명"
  });
}

// 메모를 지웁니다.
// id는 Firestore 문서 ID(문자열)입니다.
// 선생님만 지울 수 있도록 makeMemo()에서 × 버튼을 선생님에게만 보여줍니다.
// Firestore 보안 규칙에서도 동일하게 막습니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}

// 메모 내용을 Gemini(/api/gemini)에게 보내서 AI 코멘트를 받아 옵니다.
// 개인정보 보호를 위해 메모 텍스트만 보내고, uid·이름은 보내지 않습니다.
// 받은 코멘트는 memos 문서의 aiComment 필드에 저장해서 모두에게 보입니다.
// 수정 권한이 선생님에게만 있으므로(Firestore 규칙), 이 함수도 선생님만 호출합니다.
async function requestAiComment(memo) {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: memo.text })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "AI 코멘트를 받지 못했습니다.");
  }

  await updateDoc(doc(db, "memos", memo.id), {
    aiComment: data.comment
  });
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

  // 선생님만 × 버튼으로 메모를 지울 수 있습니다. (학생은 본인 메모도 삭제 불가)
  if (currentRole === "teacher") {
    const del = document.createElement("button");
    del.textContent = "×";
    // Firestore 연동 후 render()는 onSnapshot이 자동 호출하므로 별도 호출 불필요
    del.addEventListener("click", function () {
      deleteMemo(memo.id);
    });
    div.appendChild(del);
  }

  const author = document.createElement("div");
  author.className = "memoAuthor";
  author.textContent = memo.authorName || "익명";
  div.appendChild(author);

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 선생님만 AI 코멘트를 요청할 수 있습니다.
  if (currentRole === "teacher") {
    const aiBtn = document.createElement("button");
    aiBtn.className = "aiBtn";
    aiBtn.textContent = "AI 코멘트";
    aiBtn.addEventListener("click", function () {
      aiBtn.disabled = true;
      aiBtn.textContent = "생성 중...";
      requestAiComment(memo)
        .catch(function (err) {
          console.error("AI 코멘트 오류:", err);
          alert("AI 코멘트를 가져오지 못했습니다: " + err.message);
        })
        .finally(function () {
          aiBtn.disabled = false;
          aiBtn.textContent = "AI 코멘트";
        });
    });
    div.appendChild(aiBtn);
  }

  // 이미 받은 AI 코멘트가 있으면 모두에게 보여줍니다.
  if (memo.aiComment) {
    const aiComment = document.createElement("div");
    aiComment.className = "aiComment";
    aiComment.textContent = "🤖 " + memo.aiComment;
    div.appendChild(aiComment);
  }

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

    if (!currentUser) return;

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
