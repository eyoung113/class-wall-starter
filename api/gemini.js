// ===================================================
// Gemini에게 물어보는 서버 코드
//
// 선생님이 담벼락의 메모에 "AI 코멘트" 버튼을 누르면
// 브라우저(app.js)가 이 주소로 메모 내용을 보내고,
// 여기서 Gemini에게 물어본 뒤 코멘트를 돌려줍니다.
//
// 왜 서버가 필요한가요?
//   API 키를 브라우저 코드(app.js)에 적으면 누구나 볼 수 있습니다.
//   그래서 키는 서버에만 두고, 브라우저는 이 주소로 부탁만 합니다.
//
// 왜 Firebase Functions가 아니라 여기인가요?
//   Firebase Functions는 유료 요금제(Blaze)라야 씁니다.
//   이 프로젝트는 무료 요금제(Spark)로 진행하므로,
//   서버가 필요한 일은 Vercel의 무료 함수로 처리합니다.
//
// 이 파일의 규칙
//   api 폴더 안의 파일은 Vercel에서 자동으로 서버 주소가 됩니다.
//   이 파일은 /api/gemini 주소가 됩니다.
//   API 키는 코드에 적지 말고 Vercel 환경변수 GEMINI_API_KEY에 넣습니다.
//
// 모델은 무료로 쓸 수 있는 gemini-3.6-flash를 씁니다.
// (Google AI Studio: https://aistudio.google.com/apikey 에서 무료로 키를 만들 수 있습니다)
// ===================================================

const MODEL = "gemini-3.6-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 가능합니다." });
    return;
  }

  const text = req.body && req.body.text;
  if (typeof text !== "string" || text.trim() === "") {
    res.status(400).json({ error: "text가 필요합니다." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "서버에 GEMINI_API_KEY가 설정되지 않았습니다." });
    return;
  }

  // 개인정보 보호: 여기에는 메모 내용만 보냅니다. uid·이메일 등은 절대 넣지 않습니다.
  const prompt =
    "너는 초등학교 담임 선생님이야. 학생이 학급 담벼락에 남긴 아래 메모를 읽고, " +
    "짧고 따뜻한 격려 댓글을 한국어로 1~2문장만 남겨줘. 이모지는 최대 1개까지만 써도 좋아.\n\n" +
    "메모: " + text;

  try {
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        MODEL +
        ":generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error("Gemini API 오류:", data);
      const detail = data && data.error && data.error.message;
      res.status(502).json({
        error: "Gemini 호출에 실패했습니다." + (detail ? " (" + detail + ")" : "")
      });
      return;
    }

    const comment =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!comment) {
      res.status(502).json({ error: "Gemini 응답에 코멘트가 없습니다." });
      return;
    }

    res.status(200).json({ comment: comment.trim() });
  } catch (err) {
    console.error("Gemini 호출 오류:", err);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
}
