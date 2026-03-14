require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/analyze', async (req, res) => {
    const { text, dept } = req.body;

    if (!text || !dept) {
        return res.status(400).json({ error: '세특 텍스트와 학과 정보가 필요합니다.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // 사용자가 제공한 평가 기준 + 핵심 주안점을 모두 적용한 마스터 프롬프트
        const prompt = `
당신은 대학교의 베테랑 입학사정관입니다. 다음 '세부능력 및 특기사항(세특)' 텍스트를 심층 분석하여 '${dept}' 학과(계열)에 대한 3대 핵심 역량을 평가해주세요.

[★ 서류 평가 핵심 주안점 (매우 중요 - 코멘트 작성 시 반드시 반영할 것) ★]
1. 결과보다는 활동의 동기와 과정, 성장: 단순 결과(수상, 임원 등)가 아니라 어떤 목적의식으로 참여했는지, 준비 과정과 노력, 이후 어떻게 한 단계 성장했는지를 심층 파악하세요.
2. 환경 속에서의 자기주도적 노력 (맥락적 평가): 주어진 제약이나 열악한 환경 속에서도 독서, 심화 탐구 등을 통해 주도적으로 극복하려 한 맥락이 있다면 매우 긍정적으로 평가하세요.
3. 유기적 연계와 입체적 해석: 단순 수치가 아니라 텍스트에 나타난 호기심, 수업 참여도, 탐구의 깊이 등을 종합하여 진짜 실력을 판별하세요.
4. 균형 있는 3대 역량 확인: 단순 암기가 아닌 폭넓고 깊이 있는 탐구 태도와, 타인과 협력하고 나눔을 실천하는 품성을 중점적으로 살피세요.

[평가 세부 기준]
1. 학업역량: 학업성취도, 학업태도(자기주도성, 열정), 탐구력(지식의 확장)
2. 진로역량: 전공 관련 교과 이수 노력, 성취도, 진로 탐색 활동과 경험
3. 공동체역량: 협업과 소통, 나눔과 배려, 성실성과 규칙준수, 리더십

[입력 데이터]
지원 학과: ${dept}
세특 텍스트: ${text}

위 지침을 바탕으로 엄격히 분석한 뒤, 반드시 다음 형식의 JSON 형태(application/json)로만 응답해주세요. 마크다운(\`\`\`json 등)은 절대 포함하지 마세요.

{
  "overallScore": 0~100 사이의 종합 점수 (숫자),
  "overallGrade": "A+, A, B, C 중 하나",
  "overallComment": "입학사정관의 총괄 평가 의견 (위 4가지 핵심 주안점을 반영하여, 지원자의 동기-과정-성장 및 주도성을 중심으로 실제 생기부 평가처럼 3~4문장으로 깊이 있게 작성하세요.)",
  "academic": [
    { "item": "학업태도, 탐구력 등 세부항목", "keyword": "핵심 단어", "extracted": "원문 문장", "comment": "핵심 주안점(동기/과정/성장)을 반영한 심층 코멘트" }
  ],
  "career": [
    { "item": "진로 탐색 활동 등 세부항목", "keyword": "핵심 단어", "extracted": "원문 문장", "comment": "핵심 주안점(주도적 노력)을 반영한 심층 코멘트" }
  ],
  "community": [
    { "item": "리더십, 협업 등 세부항목", "keyword": "핵심 단어", "extracted": "원문 문장", "comment": "핵심 주안점(공동체 기여/소통)을 반영한 심층 코멘트" }
  ]
}
내용이 충분하면 배열에 객체를 1~3개씩 작성하고, 해당 역량을 전혀 찾을 수 없다면 빈 배열 []을 반환하세요.
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`✅ 서버가 포트 ${port} 에서 실행 중입니다.`);
});