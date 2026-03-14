require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
// 파일 용량이 클 수 있으므로 json 파싱 용량 한도를 늘려줍니다.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors()); 
app.use(express.static(path.join(__dirname)));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// 🗄️ 간이 학생 데이터베이스 (메모리 저장소)
// ==========================================
let studentDB = {};

// 1. 학생 인적사항 업로드 API
app.post('/api/students', (req, res) => {
    const { students } = req.body;
    let count = 0;
    students.forEach(s => {
        // 고유 식별키 생성 (예: 1-3-15-홍길동)
        const key = `${s.grade}-${s.class}-${s.no}-${s.name}`;
        if (!studentDB[key]) {
            studentDB[key] = { 
                grade: s.grade, 
                class: s.class, 
                no: s.no, 
                name: s.name, 
                records: [] 
            };
            count++;
        }
    });
    res.json({ message: "학생 명단이 저장되었습니다.", count: Object.keys(studentDB).length });
});

// 2. 학생 세특 내용 업로드 API
app.post('/api/records', (req, res) => {
    const { records } = req.body;
    let matchCount = 0;
    records.forEach(r => {
        const key = `${r.grade}-${r.class}-${r.no}-${r.name}`;
        // 명단에 없던 학생이라도 세특 파일에 있으면 자동 생성
        if (!studentDB[key]) {
            studentDB[key] = { grade: r.grade, class: r.class, no: r.no, name: r.name, records: [] };
        }
        studentDB[key].records.push({ subject: r.subject, content: r.content });
        matchCount++;
    });
    res.json({ message: "세특 데이터가 학생 정보에 병합되었습니다.", totalStudents: Object.keys(studentDB).length });
});

// 3. 등록된 전체 학생 목록 불러오기 API
app.get('/api/students', (req, res) => {
    // 프론트엔드에서 보기 쉽게 배열로 변환하여 반환
    const studentsArray = Object.values(studentDB).sort((a, b) => {
        if(a.grade !== b.grade) return a.grade - b.grade;
        if(a.class !== b.class) return a.class - b.class;
        return a.no - b.no;
    });
    res.json(studentsArray);
});

// 4. DB 초기화 API (새 학기/새 테스트용)
app.delete('/api/students', (req, res) => {
    studentDB = {};
    res.json({ message: "모든 학생 데이터가 초기화되었습니다." });
});


// ==========================================
// 🤖 AI 입학사정관 분석 API (12개 대학 맞춤 로직 유지)
// ==========================================
function getUniversityGuidelines(targetDept) {
    let guide = "";
    
    if (targetDept.includes("서울대학교")) {
        guide += `\n[🏫 서울대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 단순 암기보다 '깊이 있는 이해'와 지식을 활용해 성장한 '과정'을 최우선 평가합니다.\n`;
        guide += `- 핵심 기조: 난이도 높은 과목에 기꺼이 도전하는 '지적 호기심과 진취성'에 높은 점수를 줍니다.\n`;
        if (targetDept.match(/컴퓨터|산업공학|수리과학|통계|경제/)) guide += `- 전공 특화: '미적분', '확률과 통계' 중심의 수학적 논리력과 데이터 분석력을 중점 평가하세요.\n`;
        else if (targetDept.match(/의예|약학|생명|화학/)) guide += `- 전공 특화: '화학/생명과학' 중심의 깊이 있는 탐구력과 실험 과정을 중점 평가하세요.\n`;
        else guide += `- 전공 특화: 전공에 필요한 기초 과목 도전과 폭넓은 융합적 소양을 평가하세요.\n`;
    }
    else if (targetDept.includes("연세대학교")) {
        guide += `\n[🦅 연세대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 주어진 고교 환경 내에서의 '노력과 성실함', 과목 미개설 시 '공동교육과정' 등을 통한 극복 노력을 극찬하세요.\n`;
        if (targetDept.match(/컴퓨터|기계|전자/)) guide += `- 전공 특화: 수학(미적분/기하) 및 물리 역량의 주도적 이수 노력을 엄격히 평가하세요.\n`;
        else if (targetDept.match(/의예|약학|생명/)) guide += `- 전공 특화: 수학(미적분) 및 화학/생명과학 핵심 역량과 지식 확장 경험을 평가하세요.\n`;
        else guide += `- 전공 특화: 폭넓은 독서와 다방면의 인문/사회적 소양 탐구 과정을 중점 평가하세요.\n`;
    }
    else if (targetDept.includes("고려대학교")) {
        guide += `\n[🐯 고려대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 환경을 극복한 '자기계발 역량'과 논문/전공서적 등을 활용한 '깊고 폭넓은 탐구역량'을 매우 중시합니다.\n`;
        guide += `- 핵심 기조: 학과별 '핵심 권장과목' 이수 적극성을 강력하게 반영하세요.\n`;
        if (targetDept.match(/기계|전기|전자|컴퓨터|보안/)) guide += `- 전공 특화: 공학/정보의 기초인 수학(미적분/기하)과 물리 역량 기반의 문제해결력을 최우선 평가하세요.\n`;
        else if (targetDept.match(/의학|생명|보건/)) guide += `- 전공 특화: 화학과 생명과학 기반의 심도 있는 탐구 과정을 엄격히 평가하세요.\n`;
        else guide += `- 전공 특화: 융복합적 사고력과 논리적 통찰력을 집중적으로 살펴봅니다.\n`;
    }
    else if (targetDept.includes("서강대학교")) {
        guide += `\n[🕊️ 서강대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 좁은 전공적합성을 평가하지 않습니다. 특정 학과에 얽매이지 않은 '탄탄한 기초 학업역량'과 '경험에 대한 개방성, 융합적 사고(성장가능성)'를 매우 높게 평가하세요.\n`;
    }
    else if (targetDept.includes("한양대학교")) {
        guide += `\n[🦁 한양대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 실용학풍(IC-PBL). 배운 지식을 '현실의 문제'나 '데이터'에 적용해 분석하고 해결책을 도출한 융복합적 탐구 역량을 최우선으로 평가하세요.\n`;
    }
    else if (targetDept.includes("중앙대학교")) {
        guide += `\n[🏫 중앙대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 전공 간 통합적 사고를 하는 '융합형'과 한 분야를 깊이 파고드는 '탐구형' 인재를 찾습니다. 지원 전공의 '핵심 권장과목' 이수 여부를 강력하게 평가하세요.\n`;
    }
    else if (targetDept.includes("경희대학교")) {
        guide += `\n[🦁 경희대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 학과별 '수학 및 과학 핵심 권장과목' 이수 여부를 매우 엄격히 봅니다. 어려운 과목(기하, 과학Ⅱ 등)을 기피하지 않고 주도적으로 수강한 학업태도를 극찬하세요.\n`;
    }
    else if (targetDept.includes("한국외국어대학교")) {
        guide += `\n[🌐 한국외국어대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 순수 어학보다 '외국어 + 데이터/AI/실무'를 결합한 융복합적 탐구 역량과 타 문화에 대한 포용력(개방성)을 최우선으로 높게 평가하세요.\n`;
    }
    else if (targetDept.includes("서울시립대학교")) {
        guide += `\n[🏛️ 서울시립대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 학과별 '인재상 부합 여부'가 절대적 기준입니다. 선택의 '결과'보다 왜 그 과목/주제를 선택했는지 '주도적 증명 과정'을 매우 까다롭게 평가하세요.\n`;
    }
    else if (targetDept.includes("건국대학교")) {
        guide += `\n[🐂 건국대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 필수 지정 과목이 없습니다. '성장역량(경험 확장, 오류 극복)'을 핵심으로, 투박하더라도 학생이 직접 발로 뛰어 실험/탐구한 진정성 있는 과정을 최우선 평가하세요.\n`;
    }
    else if (targetDept.includes("동국대학교")) {
        guide += `\n[🐘 동국대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 맹목적인 학과 맞춤 활동보다, 해당 전공을 공부하기 위해 필수적인 '기본 교과 역량'과 명확한 학업적 목적의식이 드러나는 '학습의 주도성'을 비중 있게 평가하세요.\n`;
    }
    else if (targetDept.includes("홍익대학교")) {
        guide += `\n[🎨 홍익대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 캠퍼스자율전공의 취지에 맞게 진로의 변경을 감점하지 않습니다. 다양한 영역의 지식을 하나로 엮어 문제를 해결하는 '창의·융합적 사고능력'을 최우선으로 평가하세요.\n`;
    }
    else {
        guide += `- 핵심 기조: 지원자의 동기, 과정, 성장, 그리고 자기주도성을 중점적으로 융합하여 평가하세요.\n`;
    }
    return guide;
}

app.post('/api/analyze', async (req, res) => {
    const { text, dept } = req.body;

    if (!text || !dept) {
        return res.status(400).json({ error: '세특 텍스트와 학과 정보가 필요합니다.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const univSpecificGuidelines = getUniversityGuidelines(dept);

        const prompt = `
당신은 대학교의 매우 냉정하고 엄격한 베테랑 입학사정관입니다. 다음은 여러 과목이 종합된 학생의 '세부능력 및 특기사항(세특) 전체 모음'입니다. 이 텍스트를 종합적으로 심층 분석하여 '${dept}'에 지원하는 학생의 핵심 역량을 평가해주세요. 

[★ 서류 평가 공통 핵심 주안점 (매우 중요) ★]
1. 결과보다는 활동의 동기와 과정, 성장 (심층 파악)
2. 환경 속에서의 자기주도적 노력 (맥락적 평가)
3. 여러 과목 간의 유기적 연계와 입체적 해석 (제출된 모든 과목 세특을 융합적으로 평가하세요)
4. 균형 있는 역량 확인
${univSpecificGuidelines}

[평가 세부 기준]
1. 학업/탐구역량: 전반적인 학업태도(자기주도성, 열정), 탐구력(지식의 확장, 논문/서적 활용 등)
2. 진로/계열역량(또는 융합/성장역량): 지원 대학/학과의 특화 지침에 맞는 역량, 교과 이수 적극성
3. 공동체역량: 협업과 소통, 나눔과 배려, 실질적 리더십

[입력 데이터 (모든 과목 세특 종합)]
지원 학과: ${dept}
종합 세특 텍스트:
${text}

위 지침을 바탕으로 엄격히 분석한 뒤, 반드시 다음 형식의 JSON 형태(application/json)로만 응답해주세요. 마크다운(\`\`\`json 등)은 절대 포함하지 마세요.

{
  "overallScore": 0~100 사이의 종합 점수 (매우 엄격하게 산정),
  "overallComment": "입학사정관의 총괄 평가 의견 (지원 대학/학과의 특성을 반영하여 지원자의 강점, 융합 능력, 한계점을 3~4문장으로 작성)",
  "academicScore": 0~100 사이의 학업역량 점수,
  "careerScore": 0~100 사이의 진로(성장)역량 점수,
  "communityScore": 0~100 사이의 공동체역량 점수,
  "academic": [
    { "item": "세부항목", "keyword": "핵심 단어", "extracted": "[과목명]이 포함된 원문 문장", "comment": "심층 코멘트" }
  ],
  "career": [
    { "item": "세부항목", "keyword": "핵심 단어", "extracted": "[과목명]이 포함된 원문 문장", "comment": "심층 코멘트" }
  ],
  "community": [
    { "item": "세부항목", "keyword": "핵심 단어", "extracted": "[과목명]이 포함된 원문 문장", "comment": "심층 코멘트" }
  ]
}

주의사항: 각 역량 배열에는 해당 역량을 증명하는 모든 근거 문장을 빠짐없이 추출하되, 여러 과목의 기록이 있다면 과목 간의 융합적 요소를 칭찬하는 코멘트를 적극 작성하세요.
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