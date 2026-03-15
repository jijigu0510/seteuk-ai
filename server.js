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

    const targetMajor = req.body.major;
    const text = req.body.text;

    if (!targetMajor || !text) {
        console.error("❌ [에러] 학과 또는 텍스트 데이터가 프론트엔드에서 넘어오지 않았습니다.");
        return res.status(400).json({ error: '지원 학과와 세특 텍스트가 모두 필요합니다.' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        
        const fullPrompt = `당신은 대한민국 최상위 12개 대학의 학생부종합전형을 심층 평가하는 수석 입학사정관 시스템입니다.
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
}

=======================================
[지원 학과]: ${targetMajor}
[학생 생기부 텍스트]:
${text}
`;

        let result;
        
        try {
            // 💡 [수정] 1순위: 가장 성능이 좋은 1.5 Pro 모델 시도
            const model = genAI.getGenerativeModel({ 
                model: 'gemini-1.5-pro',
                generationConfig: {
                    responseMimeType: "application/json"
                }
            });
            result = await model.generateContent(fullPrompt);
        } catch (modelErr) {
            console.warn(`⚠️ [경고] 1.5 모델 접근 불가(${modelErr.message}). 기본 gemini-pro 모델로 우회합니다.`);
            // 💡 [수정] 2순위: API 키 제한 등으로 1.5 버전 접근 불가 시 가장 범용적인 구버전 모델 사용
            // (gemini-pro는 responseMimeType 지원이 불안정하므로 제외하고 프롬프트 지시로만 JSON을 유도합니다.)
            const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
            result = await fallbackModel.generateContent(fullPrompt);
        }

        let rawText = result.response.text();
        console.log("🤖 [AI 원본 응답 수신 완료]");
        
        // 💡 [추가] AI가 무시하고 마크다운(```json)을 포함해 보낼 경우를 완벽하게 대비
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        let parsedData;
        try {
            parsedData = JSON.parse(rawText);
        } catch (parseError) {
            console.error("❌ [JSON 파싱 에러] AI 원본 텍스트:\n", rawText);
            throw new Error("AI 응답을 처리하는 중 데이터 형식이 어긋났습니다. (JSON Parse Error)");
        }

        console.log(`✅ [분석 파싱 완료] ${targetMajor} 맞춤 평가 성공`);
        res.json(parsedData);

    } catch (error) {
        console.error('❌ [Gemini API / 종합 에러]:', error);
        res.status(500).json({ error: `AI 분석 중 서버 오류 발생: ${error.message}` });
    }
});

// 💡 [수정] Express 5.x 라우팅 에러 해결: '*' 문자열 대신 정규식(/.*/) 사용
// Express 5 에서는 '*' 단독 사용 시 'Missing parameter name' 에러가 발생합니다.
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 호스트를 '0.0.0.0'으로 명시 지정 (Render 타임아웃 방지)
app.listen(port, '0.0.0.0', () => {
    console.log(`✅ 서버가 포트 ${port} 에서 정상적으로 실행 중입니다.`);
});