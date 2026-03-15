require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// index.html 등 정적 파일 제공
app.use(express.static(path.join(__dirname)));

// 환경 변수에서 API 키를 가져옵니다.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/analyze', async (req, res) => {
    const { major, text } = req.body;

    if (!major || !text) {
        return res.status(400).json({ error: '지원 학과와 세특 텍스트가 모두 필요합니다.' });
    }

    try {
        const systemPrompt = `
당신은 대학 입학사정관입니다. 사용자가 입력한 학생의 '종합 세특 텍스트'와 '지원 학과'를 바탕으로 3대 핵심 역량(학업, 진로, 공동체)을 평가하십시오.

[핵심 기준]
1. 학업역량: 문제 해결을 위한 지식 확장과 주도적 탐구력.
2. 진로역량: 지원 학과 연계성, 융복합적 진로 탐색.
3. 공동체역량: 협력, 소통, 리더십.

[응답 필수 JSON 스키마 (엄수)]
{
  "overallScore": 숫자(0~100),
  "suitabilityPercent": 숫자(0~100),
  "overallComment": "총괄 평가 코멘트",
  "academic": { "score": 숫자, "grade": "등급(A~D)", "details": [{"item": "세부항목", "extracted": "세특 원문", "comment": "심층 해석"}] },
  "career": { "score": 숫자, "grade": "등급(A~D)", "details": [{"item": "세부항목", "extracted": "세특 원문", "comment": "심층 해석"}] },
  "community": { "score": 숫자, "grade": "등급(A~D)", "details": [{"item": "세부항목", "extracted": "세특 원문", "comment": "심층 해석"}] }
}`;

        // Gemini 1.5 Flash (또는 2.5 Flash) 모델 사용
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            systemInstruction: systemPrompt 
        });
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: `지원 학과: ${major}\n\n[학생 세특 기록]\n${text}` }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const parsedData = JSON.parse(result.response.text());
        res.json(parsedData);

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'AI 서버 에러 발생' });
    }
});

// 루트 접속 시 index.html 띄우기
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`✅ 서버가 포트 ${port}에서 실행 중입니다.`);
});