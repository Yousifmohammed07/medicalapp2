// --- 1. الإعدادات العامة والمتغيرات السحابية ---
const EXAMS_COLLECTION = "exams";
let unlockedLevel = parseInt(localStorage.getItem('unlockedLevel')) || 1;

// متغيرات الاختبار النشط (Quiz Engine)
let currentQuestions = [];
let currentIdx = 0;
let score = 0;
let selectedIdx = null;

// --- 2. وظائف لوحة التحكم (Admin) - الرفع للسحاب ---

/**
 * إنشاء مستوى جديد في Firebase
 * تم استبدال localStorage.setItem بـ db.collection.add
 */
async function createNewLevel() {
    const num = document.getElementById('new-lvl-num').value;
    const title = document.getElementById('new-lvl-title').value;
    const icon = document.getElementById('new-lvl-icon').value || "📚";
    
    if(!num || !title) return alert("يرجى إدخال رقم المستوى وعنوانه!");
    
    try {
        await db.collection(EXAMS_COLLECTION).doc(num).set({
            num: parseInt(num),
            title: title,
            icon: icon,
            questions: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("تم رفع المستوى " + num + " إلى السحاب بنجاح 🚀");
        location.reload(); 
    } catch (e) { 
        console.error("خطأ في الرفع:", e);
        alert("فشل الرفع، تأكد من اتصال الإنترنت وقواعد الحماية.");
    }
}

/**
 * إضافة سؤال جديد إلى مستوى معين في السحاب
 */
async function addNewQuestion() {
    const lvlId = document.getElementById('lvl-select').value;
    const qText = document.getElementById('new-q').value;
    const fileInput = document.getElementById('new-q-img-file');
    
    if(!qText || !lvlId) return alert("يرجى كتابة السؤال واختيار المستوى!");

    let imageData = "";
    if (fileInput && fileInput.files && fileInput.files[0]) {
        imageData = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(fileInput.files[0]);
        });
    }

    const newQuestion = {
        id: Date.now(),
        q: qText,
        img: imageData,
        options: [
            document.getElementById('opt-0').value,
            document.getElementById('opt-1').value,
            document.getElementById('opt-2').value
        ],
        correct: parseInt(document.getElementById('correct-idx').value),
        exp: document.getElementById('new-exp').value
    };

    try {
        const lvlRef = db.collection(EXAMS_COLLECTION).doc(lvlId);
        const doc = await lvlRef.get();
        const existingQuestions = doc.data().questions || [];
        
        await lvlRef.update({
            questions: [...existingQuestions, newQuestion]
        });
        alert("تم حفظ السؤال بنجاح في السحاب ✅");
        location.reload();
    } catch (e) { alert("خطأ أثناء الحفظ: " + e.message); }
}

// --- 3. وظائف صفحة الاختبار (Exam) - العرض السحابي ---

/**
 * جلب المستويات من Firebase وعرضها في لوحة التحكم
 */
async function updateExamDashboard() {
    const grid = document.getElementById('levels-grid');
    if(!grid) return;
    
    try {
        const snap = await db.collection(EXAMS_COLLECTION).orderBy("num", "asc").get();
        if(snap.empty) {
            grid.innerHTML = "<p style='text-align:center; grid-column:1/-1;'>لا توجد مستويات متاحة حالياً.</p>";
            return;
        }

        grid.innerHTML = "";
        snap.docs.forEach(doc => {
            const lvl = doc.data();
            const isLocked = lvl.num > unlockedLevel;
            grid.innerHTML += `
                <div class="track-card ${isLocked ? 'locked' : ''}" onclick="${isLocked ? '' : `startExamLevel('${doc.id}')`}">
                    <div class="track-icon">${lvl.icon}</div>
                    <h3>المستوى ${lvl.num}</h3>
                    <p>${lvl.title}</p>
                    <span class="status-tag">${isLocked ? '🔒 مغلق' : (lvl.num < unlockedLevel ? '✅ مكتمل' : '🔓 مفتوح')}</span>
                </div>`;
        });
    } catch (e) { console.error("خطأ في جلب المستويات:", e); }
}

/**
 * بدء الاختبار لمستوى معين
 */
async function startExamLevel(lvlId) {
    try {
        const doc = await db.collection(EXAMS_COLLECTION).doc(lvlId).get();
        currentQuestions = doc.data().questions || [];
        
        if(currentQuestions.length === 0) return alert("هذا المستوى لا يحتوي على أسئلة بعد!");
        
        currentIdx = 0; 
        score = 0;
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('quiz-screen').style.display = 'block';
        showQuestion();
    } catch (e) { alert("تعذر بدء الاختبار."); }
}

// --- 4. محرك الاختبار (Quiz Engine) ---

function showQuestion() {
    const q = currentQuestions[currentIdx];
    selectedIdx = null;
    
    document.getElementById('q-text').innerText = q.q;
    const imgEl = document.getElementById('q-img');
    if(q.img) { imgEl.src = q.img; imgEl.style.display = 'block'; } 
    else { imgEl.style.display = 'none'; }

    const optsContainer = document.getElementById('options-container');
    optsContainer.innerHTML = q.options.map((opt, i) => `
        <div class="option" onclick="selectOption(${i})">${opt}</div>
    `).join('');
    
    document.getElementById('feedback').style.display = 'none';
    document.getElementById('submit-btn').style.display = 'block';
    document.getElementById('next-btn').style.display = 'none';
    
    // تحديث شريط التقدم
    const progress = ((currentIdx) / currentQuestions.length) * 100;
    document.getElementById('progress-fill').style.width = progress + "%";
}

function selectOption(idx) {
    selectedIdx = idx;
    document.querySelectorAll('.option').forEach((el, i) => {
        el.classList.toggle('selected', i === idx);
    });
}

function submitAnswer() {
    if(selectedIdx === null) return alert("يرجى اختيار إجابة!");
    
    const q = currentQuestions[currentIdx];
    const feedback = document.getElementById('feedback');
    const options = document.querySelectorAll('.option');
    
    if(selectedIdx === q.correct) {
        score++;
        options[selectedIdx].classList.add('correct');
        feedback.innerHTML = `<h4 style="color:#27ae60">إجابة صحيحة! 🎉</h4><p>${q.exp}</p>`;
    } else {
        options[selectedIdx].classList.add('wrong');
        options[q.correct].classList.add('correct');
        feedback.innerHTML = `<h4 style="color:#c0392b">للأسف، إجابة خاطئة</h4><p>${q.exp}</p>`;
    }

    feedback.style.display = 'block';
    document.getElementById('submit-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'block';
}

function nextQuestion() {
    currentIdx++;
    if(currentIdx < currentQuestions.length) {
        showQuestion();
    } else {
        finishExam();
    }
}

// ابحث عن دالة finishExam واستبدلها بهذا الجزء المطور:
// --- كودك الأصلي مع إضافة زر الشهادة فقط ---
// استبدل دالة finishExam في ملف script.js بهذا الكود:
function finishExam() {
    const percent = (score / currentQuestions.length) * 100;
    const passed = percent >= 70;
    const quizScreen = document.getElementById('quiz-screen');
    
    // استخدام innerHTML لضمان بناء الواجهة بالكامل بما فيها الزر
    quizScreen.innerHTML = `
        <div class="question-card" style="text-align:center; border: 2px solid var(--yellow);">
            <h2 style="color:var(--yellow)">${passed ? '🎉 أحسنت! لقد اجتزت الاختبار' : '🔁 حاول ثانية'}</h2>
            <div style="font-size:4rem; margin:20px 0; color:white;">${score} / ${currentQuestions.length}</div>
            <p style="color:#ccc;">النسبة المئوية: ${Math.round(percent)}%</p>
            
            ${passed ? `
                <div style="margin-top:25px; padding:20px; background:rgba(255,140,0,0.1); border-radius:15px;">
                    <p style="color:var(--yellow); font-weight:bold;">🏆 استحققت شهادة التميز</p>
                    <input type="text" id="cert-name" placeholder="اكتب اسمك الثلاثي للشهادة" 
                           style="width:90%; padding:12px; margin:10px 0; border-radius:10px; border:1px solid var(--orange); background:#0a1120; color:white;">
                    <button class="btn-primary" onclick="generateAcademyCertificate(document.getElementById('cert-name').value)">
                        إصدار وتحميل الشهادة 📥
                    </button>
                </div>
            ` : ''}
            
            <button class="btn-primary" onclick="location.reload()" style="background:#333; margin-top:15px;">العودة للمسار</button>
        </div>`;

    // الحفاظ على ميزة فتح المستويات الأصلية
    if(passed && unlockedLevel <= unlockedLevel) { // تعديل بسيط لضمان التوافق
        unlockedLevel++;
        localStorage.setItem('unlockedLevel', unlockedLevel);
    }
}

// دالة توليد الشهادة (تأكد من وجودها في script.js)
function generateAcademyCertificate(userName) {
    if(!userName) return alert("يرجى كتابة الاسم ليظهر في الشهادة");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'l' });
    
    doc.setLineWidth(2); doc.setDrawColor(255, 215, 0); doc.rect(5, 5, 287, 200);
    doc.setTextColor(255, 140, 0); doc.setFontSize(40);
    doc.text("CERTIFICATE", 148, 50, { align: "center" });
    doc.setTextColor(0, 0, 0); doc.setFontSize(20);
    doc.text("OF COMPLETION", 148, 65, { align: "center" });
    doc.text("This is to certify that:", 148, 95, { align: "center" });
    doc.setFontSize(30); doc.setTextColor(184, 134, 11);
    doc.text(userName, 148, 115, { align: "center" });
    doc.setFontSize(15); doc.setTextColor(0, 0, 0);
    doc.text("Has successfully passed the Academy Exam", 148, 135, { align: "center" });
    doc.text("Date: " + new Date().toLocaleDateString(), 20, 185);
    
    doc.save(`Medical_Camera_Cert_${userName}.pdf`);
}
// --- 5. بيانات الأطلس (تم الحفاظ عليها بالكامل) ---
const globalAtlasData = {
    "Upper": [
        {
            title: "وضعية اليد (Hand PA)",
            img: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/X-ray_of_the_hand_PA_view.jpg/640px-X-ray_of_the_hand_PA_view.jpg",
            cr: "عمودي على المفصل الثالث (3rd MCP joint).",
            sid: "100 سم",
            factors: "kVp: 50-55 | mAs: 2-4",
            ir: "24×30 سم، طولي.",
            instr: "وضع كف اليد منبسطاً على الكاشف، مع مباعدة الأصابع قليلاً.",
            criteria: "ظهور كامل عظام اليد والرسغ، مفاصل الأصابع مفتوحة."
        }
    ],
    "Lower": [],
    "Chest": [],
    "Spine": [],
    "Skull": []
};

// --- 6. تشغيل النظام عند التحميل ---
window.onload = () => {
    // تحديث واجهة الاختبارات
    updateExamDashboard();
    
    // إعداد قائمة المستويات في صفحة الإدارة
    const lvlSelect = document.getElementById('lvl-select');
    if(lvlSelect) {
        db.collection(EXAMS_COLLECTION).orderBy("num", "asc").get().then(snap => {
            lvlSelect.innerHTML = snap.docs.map(doc => 
                `<option value="${doc.id}">المستوى ${doc.data().num} - ${doc.data().title}</option>`
            ).join('');
        });
    }
};

// دالة لزيادة عداد الزوار في كل مرة تفتح فيها الصفحة الرئيسية
async function updateVisitorCount() {
    const counterRef = db.collection("site_stats").doc("visitors");
    
    // استخدام Increment لضمان الدقة في السحاب
    await counterRef.update({
        count: firebase.firestore.FieldValue.increment(1)
    });

    // جلب الرقم لعرضه (اختياري)
    const doc = await counterRef.get();
    console.log("إجمالي الزيارات: " + doc.data().count);
}



