require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); 
// JSON 파싱 용량 한도 증가 (대용량 세특 파일 업로드 대응)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname)));


// ==========================================
// 🔑 API 키 직접 입력 (가장 확실하고 쉬운 방법)
// ==========================================
// ★ 선생님! 아래 "여기에_API_키를_넣어주세요" 글자를 지우고 
// 따옴표(" ") 안에 발급받으신 AIzaSy... 로 시작하는 API 키를 직접 붙여넣어 주세요! ★
const MY_API_KEY = "AIzaSyAF99AnI98lis3EspqOHyERMoKvUgLbhlk";


// 경고 메시지 로직
if (MY_API_KEY === "AIzaSyAF99AnI98lis3EspqOHyERMoKvUgLbhlk") {
    console.error("\n========================================================");
    console.error("❌ [경고] API 키가 입력되지 않았습니다!");
    console.error("server.js 파일의 22번째 줄에 API 키를 직접 입력해주세요.");
    console.error("========================================================\n");
}

const genAI = new GoogleGenerativeAI(MY_API_KEY);

// ==========================================
// 🗄️ 간이 학생 데이터베이스 (서버 메모리 저장소)
// ==========================================
let studentDB = {};

// 학생 고유 키 생성 함수 (이름 기준, 공백 제거)
function getStudentKey(name) {
    if (!name) return null;
    return name.replace(/\s+/g, '');
}

// 1. 학생 명단(학적사항) 업로드 API (일반 명단 + 나이스 학년이력 완벽 지원)
app.post('/api/students', (req, res) => {
    const { students } = req.body;
    let count = 0;
    
    // students 배열은 프론트엔드에서 이미 파싱되어 넘어온 객체 배열임
    students.forEach(s => {
        const key = getStudentKey(s.name);
        if (key) {
            if (!studentDB[key]) {
                studentDB[key] = { 
                    name: key, 
                    grade: s.grade || "", 
                    class: s.class || "", 
                    no: s.no || "", 
                    subjects: [], 
                    changche: [], 
                    haengteuk: [] 
                };
                count++;
            } else {
                // 이미 존재하는 학생이면 최신 정보(학년/반/번호)로 업데이트
                if (s.grade && !isNaN(parseInt(s.grade))) studentDB[key].grade = s.grade;
                if (s.class && !isNaN(parseInt(s.class))) studentDB[key].class = s.class;
                if (s.no && !isNaN(parseInt(s.no))) studentDB[key].no = s.no;
            }
        }
    });
    
    // 쓰레기 데이터 정리
    for(let key in studentDB) {
        if(key.length < 2 || !isNaN(key) || (!studentDB[key].grade && !studentDB[key].class && studentDB[key].subjects.length === 0 && studentDB[key].changche.length === 0 && studentDB[key].haengteuk.length === 0)) {
            delete studentDB[key];
        }
    }

    res.json({ message: `총 ${Object.keys(studentDB).length}명의 학생 정보가 저장/업데이트 되었습니다.`, count: Object.keys(studentDB).length });
});

// 2. 교과 세특 업로드 API
app.post('/api/records/subject', (req, res) => {
    const { records } = req.body;
    let count = 0;
    
    records.forEach(r => {
        const key = getStudentKey(r.name);
        if (key && r.content && r.content.length > 5) {
            if (!studentDB[key]) {
                studentDB[key] = { name: key, grade: "", class: "", no: "", subjects: [], changche: [], haengteuk: [] };
            }
            studentDB[key].subjects.push({ title: r.title || '교과세특', content: r.content });
            count++;
        }
    });
    res.json({ message: `교과 세특 ${count}건이 학생별로 병합되었습니다.`, count });
});

// 3. 창체 활동 업로드 API
app.post('/api/records/changche', (req, res) => {
    const { records } = req.body;
    let count = 0;
    
    records.forEach(r => {
        const key = getStudentKey(r.name);
        if (key && r.content && r.content.length > 5) {
            if (!studentDB[key]) {
                studentDB[key] = { name: key, grade: "", class: "", no: "", subjects: [], changche: [], haengteuk: [] };
            }
            studentDB[key].changche.push({ title: r.title || '창체활동', content: r.content });
            count++;
        }
    });
    res.json({ message: `창체 활동 ${count}건이 학생별로 병합되었습니다.`, count });
});

// 4. 행특 업로드 API
app.post('/api/records/haengteuk', (req, res) => {
    const { records } = req.body;
    let count = 0;
    
    records.forEach(r => {
        const key = getStudentKey(r.name);
        if (key && r.content && r.content.length > 5) {
            if (!studentDB[key]) {
                studentDB[key] = { name: key, grade: "", class: "", no: "", subjects: [], changche: [], haengteuk: [] };
            }
            studentDB[key].haengteuk.push({ title: '행동특성', content: r.content });
            count++;
        }
    });
    res.json({ message: `행동특성 ${count}건이 학생별로 병합되었습니다.`, count });
});

// 5. 전체 학생 목록 및 데이터 불러오기 API
app.get('/api/students', (req, res) => {
    const studentsArray = Object.values(studentDB).sort((a, b) => a.name.localeCompare(b.name));
    res.json(studentsArray);
});

// 6. DB 초기화 API
app.delete('/api/students', (req, res) => {
    studentDB = {};
    res.json({ message: "DB가 성공적으로 초기화되었습니다." });
});


// ==========================================
// 🤖 AI 입학사정관 분석 API
// ==========================================
function getUniversityGuidelines(targetDept) {
    let guide = "";
    
    if (targetDept.includes("서울대학교")) {
        guide += `\n[🏫 서울대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 단순 암기보다 '깊이 있는 이해'와 지식을 활용해 성장한 '과정'을 최우선 평가합니다.\n`;
        if (targetDept.match(/컴퓨터|산업공학|수리과학|통계|경제/)) guide += `- 전공 특화: '미적분', '확률과 통계' 중심의 수학적 논리력을 중점 평가하세요.\n`;
        else if (targetDept.match(/의예|약학|생명|화학/)) guide += `- 전공 특화: '화학/생명과학' 중심의 깊이 있는 탐구력과 실험 과정을 중점 평가하세요.\n`;
        else guide += `- 전공 특화: 전공에 필요한 기초 과목 도전과 폭넓은 융합적 소양을 평가하세요.\n`;
    } else if (targetDept.includes("연세대학교")) {
        guide += `\n[🦅 연세대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 주어진 고교 환경 내에서의 '노력과 성실함', 과목 미개설 시 '공동교육과정' 등을 통한 극복 노력을 극찬하세요.\n`;
        if (targetDept.match(/컴퓨터|기계|전자/)) guide += `- 전공 특화: 수학(미적분/기하) 및 물리 역량의 주도적 이수 노력을 엄격히 평가하세요.\n`;
        else if (targetDept.match(/의예|약학|생명/)) guide += `- 전공 특화: 수학(미적분) 및 화학/생명과학 핵심 역량과 지식 확장 경험을 평가하세요.\n`;
        else guide += `- 전공 특화: 폭넓은 독서와 다방면의 인문/사회적 소양 탐구 과정을 중점 평가하세요.\n`;
    } else if (targetDept.includes("고려대학교")) {
        guide += `\n[🐯 고려대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 환경을 극복한 '자기계발 역량'과 논문/전공서적 등을 활용한 '깊고 폭넓은 탐구역량'을 매우 중시합니다.\n`;
        if (targetDept.match(/기계|전기|전자|컴퓨터|보안/)) guide += `- 전공 특화: 공학/정보의 기초인 수학(미적분/기하)과 물리 역량 기반의 문제해결력을 최우선 평가하세요.\n`;
        else if (targetDept.match(/의학|생명|보건/)) guide += `- 전공 특화: 화학과 생명과학 기반의 심도 있는 탐구 과정을 엄격히 평가하세요.\n`;
        else guide += `- 전공 특화: 융복합적 사고력과 논리적 통찰력을 집중적으로 살펴봅니다.\n`;
    } else if (targetDept.includes("서강대학교")) {
        guide += `\n[🕊️ 서강대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 좁은 전공적합성을 평가하지 않습니다. 특정 학과에 얽매이지 않은 '탄탄한 기초 학업역량'과 '경험에 대한 개방성, 융합적 사고(성장가능성)'를 매우 높게 평가하세요.\n`;
    } else if (targetDept.includes("한양대학교")) {
        guide += `\n[🦁 한양대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 실용학풍(IC-PBL). 배운 지식을 '현실의 문제'나 '데이터'에 적용해 분석하고 해결책을 도출한 융복합적 탐구 역량을 최우선으로 평가하세요.\n`;
    } else if (targetDept.includes("중앙대학교")) {
        guide += `\n[🏫 중앙대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 전공 간 통합적 사고를 하는 '융합형'과 한 분야를 깊이 파고드는 '탐구형' 인재를 찾습니다. 지원 전공의 '핵심 권장과목' 이수 여부를 강력하게 평가하세요.\n`;
    } else if (targetDept.includes("경희대학교")) {
        guide += `\n[🦁 경희대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 학과별 '수학 및 과학 핵심 권장과목' 이수 여부를 매우 엄격히 봅니다. 어려운 과목(기하, 과학Ⅱ 등)을 기피하지 않고 주도적으로 수강한 학업태도를 극찬하세요.\n`;
    } else if (targetDept.includes("한국외국어대학교")) {
        guide += `\n[🌐 한국외국어대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 순수 어학보다 '외국어 + 데이터/AI/실무'를 결합한 융복합적 탐구 역량과 타 문화에 대한 포용력(개방성)을 최우선으로 높게 평가하세요.\n`;
    } else if (targetDept.includes("서울시립대학교")) {
        guide += `\n[🏛️ 서울시립대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 학과별 '인재상 부합 여부'가 절대적 기준입니다. 선택의 '결과'보다 왜 그 과목/주제를 선택했는지 '주도적 증명 과정'을 매우 까다롭게 평가하세요.\n`;
    } else if (targetDept.includes("건국대학교")) {
        guide += `\n[🐂 건국대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 필수 지정 과목이 없습니다. '성장역량(경험 확장, 오류 극복)'을 핵심으로, 투박하더라도 학생이 직접 발로 뛰어 실험/탐구한 진정성 있는 과정을 최우선 평가하세요.\n`;
    } else if (targetDept.includes("동국대학교")) {
        guide += `\n[🐘 동국대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 맹목적인 학과 맞춤 활동보다, 해당 전공을 공부하기 위해 필수적인 '기본 교과 역량'과 명확한 학업적 목적의식이 드러나는 '학습의 주도성'을 비중 있게 평가하세요.\n`;
    } else if (targetDept.includes("홍익대학교")) {
        guide += `\n[🎨 홍익대학교 특별 평가 지침]\n`;
        guide += `- 핵심 기조: 캠퍼스자율전공의 취지에 맞게 진로의 변경을 감점하지 않습니다. 다양한 영역의 지식을 하나로 엮어 문제를 해결하는 '창의·융합적 사고능력'을 최우선으로 평가하세요.\n`;
    } else {
        guide += `- 핵심 기조: 지원자의 동기, 과정, 성장, 그리고 자기주도성을 중점적으로 융합하여 평가하세요.\n`;
    }
    return guide;
}

app.post('/api/analyze', async (req, res) => {
    const { text, dept } = req.body;

    // 변경점: process.env.GEMINI_API_KEY 대신 MY_API_KEY 변수만 확인하도록 수정
    if (!MY_API_KEY || MY_API_KEY === "여기에_API_키를_넣어주세요") {
        return res.status(500).json({ error: '서버 파일(server.js)에 API 키가 입력되지 않았습니다. server.js 코드를 열고 22번째 줄에 키를 직접 입력해주세요.' });
    }

    if (!text || !dept) {
        return res.status(400).json({ error: '세특 텍스트와 학과 정보가 필요합니다.' });
    }

    try {
        const univSpecificGuidelines = getUniversityGuidelines(dept);

        const prompt = `
당신은 대학교의 매우 냉정하고 엄격한 베테랑 입학사정관입니다. 다음은 여러 과목이 종합된 학생의 '학교생활기록부(교과/창체/행특) 전체 모음'입니다. 이 텍스트를 종합적으로 심층 분석하여 '${dept}'에 지원하는 학생의 핵심 역량을 평가해주세요. 

[★ 서류 평가 공통 핵심 주안점 (매우 중요) ★]
1. 결과보다는 활동의 동기와 과정, 성장 (심층 파악)
2. 여러 영역(교과, 자율, 동아리, 진로, 행특) 간의 유기적 연계와 입체적 해석 (제출된 모든 기록을 융합적으로 평가하세요)
3. 환경 속에서의 자기주도적 노력 (맥락적 평가)
${univSpecificGuidelines}

[평가 세부 기준]
1. 학업/탐구역량: 전반적인 학업태도(자기주도성), 교과 세특 등에서 드러나는 끈질긴 탐구력
2. 진로/계열역량(또는 융합/성장역량): 창체/진로활동 및 교과 이수를 통해 보여준 지원 전공에 대한 관심과 융합적 시각
3. 공동체역량: 행특과 자율활동 등에서 나타난 협업, 배려, 실질적 리더십

반드시 다음 형식의 JSON 형태(application/json)로만 응답해주세요. 마크다운 기호 없이 순수 JSON만 반환하세요.
{
  "overallScore": 0~100 사이 종합 점수,
  "overallComment": "입학사정관의 총괄 평가 의견 (강점, 융합능력, 한계점 3~4문장)",
  "academicScore": 0~100 사이 학업역량 점수,
  "careerScore": 0~100 사이 진로역량 점수,
  "communityScore": 0~100 사이 공동체역량 점수,
  "academic": [{ "item": "세부항목", "keyword": "핵심 단어", "extracted": "[영역명] 원문", "comment": "코멘트" }],
  "career": [{ "item": "세부항목", "keyword": "핵심 단어", "extracted": "[영역명] 원문", "comment": "코멘트" }],
  "community": [{ "item": "세부항목", "keyword": "핵심 단어", "extracted": "[영역명] 원문", "comment": "코멘트" }]
}
`;
        
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            systemInstruction: prompt 
        });
        
        const userQuery = `지원 학과: ${dept}\n종합 생기부 텍스트:\n${text}`;
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userQuery }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const response = await result.response;
        let jsonText = response.text();
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsedData = JSON.parse(jsonText);
        res.json(parsedData);

    } catch (error) {
        console.error('Gemini API Error:', error);
        const errorMessage = error.message || '알 수 없는 서버 오류가 발생했습니다.';
        res.status(500).json({ error: `AI 서버 에러: ${errorMessage}` });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`✅ 서버가 포트 ${port} 에서 실행 중입니다.`);
});