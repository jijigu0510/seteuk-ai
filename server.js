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

        // ★ 평가 강도를 '매우 엄격'으로 올리고, 근거를 빠짐없이 찾도록 지시 ★
        const prompt = `
당신은 대학교의 매우 냉정하고 엄격한 베테랑 입학사정관입니다. 다음 '세부능력 및 특기사항(세특)' 텍스트를 심층 분석하여 '${dept}' 학과(계열)에 대한 3대 핵심 역량을 평가해주세요. 
절대 점수를 후하게 주지 마세요. 단순 나열식, 뻔한 미사여구, 결과 중심의 서술에는 가차 없이 낮은 점수(50점 이하)를 부여하고, 오직 '구체적인 동기-과정-성장'이 뚜렷한 경우에만 높은 점수를 부여하세요.

[★ 서류 평가 핵심 주안점 (매우 중요) ★]
1. 결과보다는 활동의 동기와 과정, 성장 (심층 파악)
2. 환경 속에서의 자기주도적 노력 (맥락적 평가)
3. 유기적 연계와 입체적 해석
4. 균형 있는 3대 역량 확인

[평가 세부 기준]
1. 학업역량: 학업성취도, 학업태도(자기주도성, 열정), 탐구력(지식의 확장)
2. 진로역량: 전공 관련 교과 이수 노력, 성취도, 진로 탐색 활동과 경험
3. 공동체역량: 협업과 소통, 나눔과 배려, 성실성과 규칙준수, 리더십

[입력 데이터]
지원 학과: ${dept}
세특 텍스트: ${text}

위 지침을 바탕으로 엄격히 분석한 뒤, 반드시 다음 형식의 JSON 형태(application/json)로만 응답해주세요. 마크다운(\`\`\`json 등)은 절대 포함하지 마세요.

{
  "overallScore": 0~100 사이의 종합 점수 (매우 엄격하게 산정),
  "overallComment": "입학사정관의 총괄 평가 의견 (지원자의 한계점과 보완점도 냉철하게 지적하며 3~4문장으로 작성)",
  "academicScore": 0~100 사이의 학업역량 점수,
  "careerScore": 0~100 사이의 진로역량 점수,
  "communityScore": 0~100 사이의 공동체역량 점수,
  "academic": [
    { "item": "세부항목", "keyword": "핵심 단어", "extracted": "원문 문장", "comment": "심층 코멘트" }
  ],
  "career": [
    { "item": "세부항목", "keyword": "핵심 단어", "extracted": "원문 문장", "comment": "심층 코멘트" }
  ],
  "community": [
    { "item": "세부항목", "keyword": "핵심 단어", "extracted": "원문 문장", "comment": "심층 코멘트" }
  ]
}

주의사항 1: 각 역량(academic, career, community) 배열 안에는 해당 역량을 증명하는 "모든 근거 문장"을 하나도 빠짐없이 찾아서 각각 별도의 객체로 만들어 넣으세요. 하나의 세부 항목이라도 문맥이 다르면 여러 개를 추출해야 합니다.
주의사항 2: 해당 역량을 뒷받침할 만한 문맥을 전혀 찾을 수 없다면, 점수를 40점 미만으로 낮게 주고 해당 배열은 빈 배열 []로 반환하세요. 억지로 지어내지 마세요.
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