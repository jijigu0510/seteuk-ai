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

// 환경 변수에서 API 키를 가져옵니다. (안전 장치 추가)
const apiKey = process.env.GEMINI_API_KEY || "API_KEY_NOT_SET";
const genAI = new GoogleGenerativeAI(apiKey);

app.post('/api/analyze', async (req, res) => {
    // API 키 누락 시 서버 크래시 방지 및 명확한 에러 반환
    if (apiKey === "API_KEY_NOT_SET") {
        console.error("❌ [ERROR] Render 환경변수에 GEMINI_API_KEY가 설정되지 않았습니다.");
        return res.status(500).json({ error: 'Render 환경변수에 GEMINI_API_KEY가 설정되지 않았습니다.' });
    }

    const { major, text } = req.body;

    if (!major || !text) {
        return res.status(400).json({ error: '지원 학과와 세특 텍스트가 모두 필요합니다.' });
    }

    try {
        // 12개 대학 특별 평가 룰셋이 모두 통합된 강력한 프롬프트
        const systemPrompt = `
당신은 대한민국 최상위 12개 대학(서울대, 연세대, 고려대, 서강대, 한양대, 중앙대, 경희대, 한국외대, 서울시립대, 건국대, 동국대, 홍익대)의 학생부종합전형을 심층 평가하는 수석 입학사정관 시스템입니다.
입력된 [지원 학과]와 [학생부 텍스트]를 분석하여 아래의 <대학별 특별 평가 룰셋>을 엄격하게 적용해 100점 만점 기준으로 채점하십시오.

<대학별 특별 평가 룰셋 요약>
- 서울대: 지적 호기심, 깊이 있는 배움, 자기주도적 학습 경험 (전공적합성 단어 지양)
- 연세대/고려대: 전공 연계 교과이수 핵심 권장과목 이수 여부 최우선, 융합적 사고
- 서강대: 전공적합성보다 '탄탄한 기초 학업역량'과 '폭넓은 융합적 성장가능성' 최고 우대
- 한양대: 실용적 문제해결력, 지식의 현실 적용 및 융복합 탐구 역량
- 중앙대/경희대/건국대/동국대: 진로 탐색의 자발성, 동기-과정-성장의 논리적 연결 (건국대는 '성장역량' 중시)
- 한국외대/서울시립대/홍익대: 글로벌 융복합, 해당 모집단위 인재상 부합 여부, 창의융합적 사고력

[핵심 기준]
1. 학업역량: 문제 해결을 위한 지식 확장과 주도적 탐구력.
2. 진로역량: 지원 학과 연계성, 융복합적 진로 탐색.
3. 공동체역량: 협력, 소통, 리더십.

[응답 필수 JSON 스키마 (엄수)]
반드시 아래 JSON 형식으로만 응답하세요. 마크다운(\`\`\`json 등) 코드는 절대 포함하지 마세요.
{
  "overallScore": 숫자(0~100),
  "suitabilityPercent": 숫자(0~100),
  "overallComment": "[지원 대학/학과]의 인재상과 룰셋을 반영한 총괄 평가 코멘트 및 면접 조언 (4~5문장)",
  "academic": { "score": 숫자, "grade": "등급(A~D)", "details": [{"item": "세부항목", "extracted": "세특 원문", "comment": "심층 해석"}] },
  "career": { "score": 숫자, "grade": "등급(A~D)", "details": [{"item": "세부항목", "extracted": "세특 원문", "comment": "심층 해석"}] },
  "community": { "score": 숫자, "grade": "등급(A~D)", "details": [{"item": "세부항목", "extracted": "세특 원문", "comment": "심층 해석"}] }
}`;

        // Gemini 1.5 Flash 모델 사용
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            systemInstruction: systemPrompt 
        });
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: `지원 학과: ${major}\n\n[학생 세특 기록]\n${text}` }] }],
            generationConfig: { responseMimeType: "application/json" } // JSON 강제
        });

        let rawText = result.response.text();
        
        // [안전 장치] AI가 마크다운을 섞어 보낼 경우를 대비한 필터링
        rawText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();

        const parsedData = JSON.parse(rawText);
        res.json(parsedData);

    } catch (error) {
        // Render 로그 창에 정확한 에러 원인 출력
        console.error('❌ [Gemini API Error]:', error);
        
        // 프론트엔드로 에러 메시지 전달
        res.status(500).json({ 
            error: 'AI 분석 중 서버 오류가 발생했습니다.', 
            details: error.message 
        });
    }
});

// 루트 접속 시 index.html 띄우기
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 호스트를 '0.0.0.0'으로 명시적으로 지정 (Render 타임아웃 해결의 핵심!)
app.listen(port, '0.0.0.0', () => {
    console.log(`✅ 서버가 포트 ${port}에서 실행 중입니다.`);
});