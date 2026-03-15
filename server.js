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
// 🔑 환경 변수에서 API 키 가져오기 (보안 유지)
// 깃허브에 API 키를 직접 적어서 올리면 구글 봇이 5초만에 키를 파기합니다!
// 반드시 Render 대시보드의 Environment Variables에 GEMINI_API_KEY를 설정하세요.
// ==========================================
const apiKey = process.env.GEMINI_API_KEY;

// 키 누락 체크 로직
if (!apiKey || apiKey === "여기에_API_키를_넣어주세요") {
    console.error("❌ [경고] GEMINI_API_KEY 환경변수가 설정되지 않았습니다!");
}

const genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");

// ==========================================
// 🗄️ 간이 학생 데이터베이스 (서버 메모리 저장소)
// ==========================================
let studentDB = {};

function getStudentKey(name) {
    if (!name) return null;
    return name.replace(/\s+/g, '');
}

// 1. 학생 명단(학적사항) 업로드 API
app.post('/api/students', (req, res) => {
    const { students } = req.body;
    let count = 0;
    
    students.forEach(s => {
        const key = getStudentKey(s.name);
        if (key) {
            if (!studentDB[key]) {
                studentDB[key] = { 
                    name: key, grade: s.grade || "", class: s.class || "", no: s.no || "", 
                    subjects: [], changche: [], haengteuk: [] 
                };
                count++;
            } else {
                if (s.grade && !isNaN(parseInt(s.grade))) studentDB[key].grade = s.grade;
                if (s.class && !isNaN(parseInt(s.class))) studentDB[key].class = s.class;
                if (s.no && !isNaN(parseInt(s.no))) studentDB[key].no = s.no;
            }
        }
    });
    
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
            if (!studentDB[key]) studentDB[key] = { name: key, grade: "", class: "", no: "", subjects: [], changche: [], haengteuk: [] };
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
            if (!studentDB[key]) studentDB[key] = { name: key, grade: "", class: "", no: "", subjects: [], changche: [], haengteuk: [] };
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
            if (!studentDB[key]) studentDB[key] = { name: key, grade: "", class: "", no: "", subjects: [], changche: [], haengteuk: [] };
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
        guide += `\n[🏫 서울대학교 특별 평가 지침]\n- 핵심 기조: 단순 암기보다 '깊이 있는 이해'와 지식을 활용해 성장한 '과정'을 최우선 평가.\n`;
    } else if (targetDept.includes("연세대학교")) {
        guide += `\n[🦅 연세대학교 특별 평가 지침]\n- 핵심 기조: 주어진 고교 환경 내에서의 '노력과 성실함', 전공 연계 핵심과목 이수 여부 평가.\n`;
    } else if (targetDept.includes("고려대학교")) {
        guide += `\n[🐯 고려대학교 특별 평가 지침]\n- 핵심 기조: 환경을 극복한 '자기계발 역량'과 논문/전공서적 등을 활용한 '깊고 폭넓은 탐구역량' 중시.\n`;
    } else if (targetDept.includes("서강대학교")) {
        guide += `\n[🕊️ 서강대학교 특별 평가 지침]\n- 핵심 기조: 좁은 전공적합성을 평가하지 않음. 탄탄한 기초 학업역량과 융합적 성장가능성 최고 우대.\n`;
    } else if (targetDept.includes("한양대학교")) {
        guide += `\n[🦁 한양대학교 특별 평가 지침]\n- 핵심 기조: 실용학풍(IC-PBL). 지식을 현실 문제나 데이터에 적용해 도출한 융복합 탐구 역량 중시.\n`;
    } else if (targetDept.includes("중앙대학교")) {
        guide += `\n[🏫 중앙대학교 특별 평가 지침]\n- 핵심 기조: 전공 간 통합적 사고(융합형)와 한 분야 심화(탐구형). 핵심 권장과목 이수 여부 강력 평가.\n`;
    } else if (targetDept.includes("경희대학교")) {
        guide += `\n[🦁 경희대학교 특별 평가 지침]\n- 핵심 기조: 학과별 '수학/과학 핵심 권장과목' 이수 엄격 평가. 어려운 과목 주도적 수강 태도 극찬.\n`;
    } else if (targetDept.includes("한국외국어대학교")) {
        guide += `\n[🌐 한국외국어대학교 특별 평가 지침]\n- 핵심 기조: 순수 어학보다 '외국어 + 데이터/AI/실무'를 결합한 융복합 탐구 역량과 타 문화 포용력 평가.\n`;
    } else if (targetDept.includes("서울시립대학교")) {
        guide += `\n[🏛️ 서울시립대학교 특별 평가 지침]\n- 핵심 기조: 인재상 부합 여부 절대적 기준. 왜 그 과목/주제를 선택했는지 '주도적 증명 과정' 평가.\n`;
    } else if (targetDept.includes("건국대학교")) {
        guide += `\n[🐂 건국대학교 특별 평가 지침]\n- 핵심 기조: 필수 과목 없음. 경험을 확장하고 오류를 극복한 진정성 있는 '성장역량' 최우선 평가.\n`;
    } else if (targetDept.includes("동국대학교")) {
        guide += `\n[🐘 동국대학교 특별 평가 지침]\n- 핵심 기조: 기본 교과 역량과 뚜렷한 학업적 목적의식이 드러나는 '학습의 주도성' 비중 있게 평가.\n`;
    } else if (targetDept.includes("홍익대학교")) {
        guide += `\n[🎨 홍익대학교 특별 평가 지침]\n- 핵심 기조: 자율전공 취지에 맞게 다양한 영역의 지식을 엮어 문제를 해결하는 '창의·융합적 사고능력' 중시.\n`;
    } else {
        guide += `- 핵심 기조: 지원자의 동기, 과정, 성장, 그리고 자기주도성을 중점적으로 융합하여 평가하세요.\n`;
    }
    return guide;
}

app.post('/api/analyze', async (req, res) => {
    const { text, dept } = req.body;

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Render 환경 변수(Environment Variables)에 GEMINI_API_KEY가 등록되지 않았습니다!' });
    }
    if (!text || !dept) {
        return res.status(400).json({ error: '세특 텍스트와 학과 정보가 필요합니다.' });
    }

    try {
        const univSpecificGuidelines = getUniversityGuidelines(dept);
        const prompt = `
당신은 대학교의 냉정하고 엄격한 입학사정관입니다. 
입력된 학생의 생기부를 융합적으로 분석하여 '${dept}' 지원 적합성을 평가하세요.

${univSpecificGuidelines}

[평가 기준]
1. 학업/탐구역량: 자기주도성, 끈질긴 탐구력
2. 진로/계열역량: 전공 관련 융합적 시각 및 진로 탐색
3. 공동체역량: 협업, 배려, 리더십

반드시 다음 형식의 JSON 형태(application/json)로만 응답해주세요. 마크다운 기호 금지.
{
  "overallScore": 0~100 숫자,
  "overallComment": "총괄 평가 의견 (3~4문장)",
  "academicScore": 0~100 숫자,
  "careerScore": 0~100 숫자,
  "communityScore": 0~100 숫자,
  "academic": [{ "item": "세부항목", "keyword": "핵심 단어", "extracted": "[영역] 원문", "comment": "코멘트" }],
  "career": [{ "item": "세부항목", "keyword": "핵심 단어", "extracted": "[영역] 원문", "comment": "코멘트" }],
  "community": [{ "item": "세부항목", "keyword": "핵심 단어", "extracted": "[영역] 원문", "comment": "코멘트" }]
}`;
        
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            systemInstruction: prompt 
        });
        
        const userQuery = `지원 학과: ${dept}\n종합 생기부 텍스트:\n${text}`;
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userQuery }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const responseText = result.response.text();
        
        // 정규식을 통한 완벽한 JSON 추출 (마크다운 찌꺼기 완벽 차단)
        let jsonText = responseText;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        }

        const parsedData = JSON.parse(jsonText);
        res.json(parsedData);

    } catch (error) {
        console.error('❌ [Gemini API Error]:', error.message);
        res.status(500).json({ error: `AI 분석 실패: ${error.message}` });
    }
});

// 루트 접속
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 호스트를 '0.0.0.0'으로 명시 지정 (Render 접속 차단 방지)
app.listen(port, '0.0.0.0', () => {
    console.log(`✅ 서버가 포트 ${port} 에서 실행 중입니다.`);
});