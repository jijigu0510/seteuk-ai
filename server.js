require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); // 파일 경로를 찾기 위해 추가됨
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
// Render는 자체적으로 포트를 할당하므로 process.env.PORT를 사용해야 합니다.
const port = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json());

// ★ 중요: 백엔드 서버가 index.html(화면)도 같이 사람들에게 보여주도록 설정
app.use(express.static(path.join(__dirname)));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/analyze', async (req, res) => {
    const { text, dept } = req.body;

    if (!text || !dept) {
        return res.status(400).json({ error: '세특 텍스트와 학과 정보가 필요합니다.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let jsonText = response.text();

        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsedData = JSON.parse(jsonText);
        res.json(parsedData);

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'AI 분석 중 서버 오류가 발생했습니다.' });
    }
});

// 사람들이 사이트 주소로 들어오면 index.html을 보여줍니다.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`✅ 서버가 포트 ${port} 에서 실행 중입니다.`);
});