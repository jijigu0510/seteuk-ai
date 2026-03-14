require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3000;

// 미들웨어 설정: CORS 허용 및 JSON 바디 파싱
app.use(cors()); 
app.use(express.json());

// Gemini API 클라이언트 초기화 (.env 파일의 API 키 사용)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 세특 분석 API 엔드포인트
app.post('/api/analyze', async (req, res) => {
    const { text, dept } = req.body;

    // 예외 처리: 데이터가 없는 경우
    if (!text || !dept) {
        return res.status(400).json({ error: '세특 텍스트와 학과 정보가 필요합니다.' });
    }

    try {
        // 사용할 모델 선택 (속도와 성능이 뛰어난 2.5 flash 모델 권장)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Gemini에게 내릴 정교한 시스템 프롬프트 (JSON 형식 반환 강제)
        const prompt = `
당신은 대학교 입학사정관입니다. 다음 '세부능력 및 특기사항(세특)' 텍스트를 심층 분석하여 '${dept}' 학과에 대한 전공적합성과 3대 핵심 역량(학업역량, 진로역량, 공동체역량)을 엄격하게 평가해주세요.

[입력 데이터]
지원 학과: ${dept}
세특 텍스트: ${text}

반드시 다음 형식의 JSON 형태(application/json)로만 응답해주세요. 마크다운(\`\`\`json 등)은 절대 포함하지 마세요.

{
  "overallScore": 0~100 사이의 종합 점수 (숫자),
  "overallGrade": "A+, A, B, C 중 하나",
  "overallComment": "전체적인 평가 코멘트 (2~3문장)",
  "academic": [
    { "item": "평가항목(예: 지적 호기심)", "keyword": "원문 내 핵심 단어", "extracted": "키워드가 포함된 문장 원문", "comment": "입학사정관의 심층 코멘트" }
  ],
  "career": [
    { "item": "평가항목(예: 전공 관심도)", "keyword": "원문 내 핵심 단어", "extracted": "키워드가 포함된 문장 원문", "comment": "입학사정관의 심층 코멘트" }
  ],
  "community": [
    { "item": "평가항목(예: 리더십)", "keyword": "원문 내 핵심 단어", "extracted": "키워드가 포함된 문장 원문", "comment": "입학사정관의 심층 코멘트" }
  ]
}
각 역량별로 관련 내용이 충분히 있으면 배열에 객체 형태로 1~3개씩 작성하고, 문맥을 찾을 수 없다면 빈 배열 []을 반환하세요.
`;

        // API 호출 및 결과 대기
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let jsonText = response.text();

        // Gemini가 간혹 마크다운 블록(```json)을 씌워 보낼 경우를 대비한 텍스트 클렌징
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

        // 파싱 후 클라이언트로 전송
        const parsedData = JSON.parse(jsonText);
        res.json(parsedData);

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'AI 분석 중 서버 오류가 발생했습니다.' });
    }
});

// 서버 실행
app.listen(port, () => {
    console.log(`✅ 백엔드 서버가 http://localhost:${port} 에서 실행 중입니다.`);
    console.log(`🤖 Gemini API 연동 대기 중...`);
});