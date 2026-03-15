require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json({ limit: '50mb' })); // 대용량 텍스트 대비
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// index.html 등 정적 파일 제공
app.use(express.static(path.join(__dirname)));

// 환경변수에서 API 키 가져오기 (Render 대시보드에서 설정 필요)
const apiKey = process.env.GEMINI_API_KEY;

// 🤖 AI 사정관 분석 API 라우트
app.post('/api/analyze', async (req, res) => {
    console.log("📥 [요청 수신] AI 분석 시작...");

    if (!apiKey) {
        console.error("❌ [에러] Render 환경변수에 GEMINI_API_KEY가 없습니다.");
        return res.status(500).json({ error: '서버 환경변수에 API 키가 설정되지 않았습니다.' });
    }

    // 💡 [버그 수정 완료] 프론트엔드가 보내는 'major' 변수를 정확히 받도록 수정했습니다.
    const targetMajor = req.body.major;
    const text = req.body.text;

    if (!targetMajor || !text) {
        console.error("❌ [에러] 학과 또는 텍스트 데이터가 프론트엔드에서 넘어오지 않았습니다.");
        return res.status(400).json({ error: '지원 학과와 세특 텍스트가 모두 필요합니다.' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        // 12개 대학 룰셋 적용 프롬프트
        const prompt = `
당신은 대한민국 최상위 12개 대학의 학생부종합전형을 심층 평가하는 수석 입학사정관 시스템입니다.
지원 학과(${targetMajor})의 특성과 각 대학의 인재상/평가 룰셋을 반영하여 학생의 서류를 냉정하게 평가하십시오.

[대학별 핵심 룰셋 요약]
- 서울대/연세대/고려대: 자기주도적 학업역량, 권장과목 이수, 깊이 있는 탐구, 융합적 사고
- 서강대/한양대/성균관대: 탄탄한 기초, 실용적 문제해결력, 다전공(융복합) 잠재력
- 중앙대/경희대/외대/시립대/건국대/동국대/홍익대: 진로 탐색의 자발성, 성장역량, 모집단위 인재상 부합 여부

[평가 기준]
1. 학업역량: 문제 해결을 위한 지식 확장과 주도적 탐구력
2. 진로역량: 지원 학과 연계성, 융복합적 진로 탐색
3. 공동체역량: 협력, 소통, 리더십, 타인에 대한 배려

[응답 필수 JSON 스키마]
반드시 아래 JSON 형식으로만 응답하세요. 백틱이나 마크다운은 절대 쓰지 마세요.
{
  "overallScore": 85,
  "suitabilityPercent": 90,
  "overallComment": "총괄 평가 코멘트입니다 (4~5문장).",
  "academic": { "score": 90, "grade": "A", "details": [{"item": "자기주도성", "extracted": "원문 문장", "comment": "해석"}] },
  "career": { "score": 85, "grade": "B", "details": [{"item": "전공탐구", "extracted": "원문 문장", "comment": "해석"}] },
  "community": { "score": 88, "grade": "A", "details": [{"item": "리더십", "extracted": "원문 문장", "comment": "해석"}] }
}`;

        const userQuery = `지원 학과: ${targetMajor}\n\n[학생 생기부 텍스트]\n${text}`;
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: prompt }] },
            generationConfig: { responseMimeType: "application/json" }
        });

        let rawText = result.response.text();
        
        // 마크다운 잔재물 제거 필터
        rawText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        
        const parsedData = JSON.parse(rawText);
        console.log(`✅ [분석 완료] ${targetMajor} 맞춤 평가 성공`);
        res.json(parsedData);

    } catch (error) {
        console.error('❌ [Gemini API / 파싱 에러]:', error);
        res.status(500).json({ error: `AI 분석 중 서버 오류 발생: ${error.message}` });
    }
});

// 루트 접속 및 모든 경로 처리 (새로고침 에러 방지 - Express 5.x 정규식 문법으로 완벽 수정)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 호스트를 '0.0.0.0'으로 명시 지정 (Render 타임아웃 방지)
app.listen(port, '0.0.0.0', () => {
    console.log(`✅ 서버가 포트 ${port} 에서 정상적으로 실행 중입니다.`);
});