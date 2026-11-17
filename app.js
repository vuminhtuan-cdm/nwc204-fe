// app.js - Logic Web Ôn tập & Thi thử NWC204 (Hỗ trợ 3 đề đơn + Đề Tổng hợp 150 câu + Multi-choice + Xem ảnh)

let currentExamIdx = 0;
let currentMode = 'study'; // 'study' | 'exam' | 'review'

let examState = {
  selectedQuestionCount: 50, // 50 | 100 | 150 (cho đề tổng hợp)
  shuffledQuestions: [],
  userAnswers: {}, // { [questionId]: ['A'] or ['A', 'B'] }
  flaggedQuestions: {}, // { [questionId]: true/false }
  timerInterval: null,
  timeRemaining: 3600, // seconds
  isSubmitted: false,
  score: 0,
  filterWrongOnly: false,
  studyFilterExam: 'ALL' // 'ALL' | 'NWC204_SU26_FE' | ...
};

function getExams() {
  if (typeof window !== 'undefined' && window.EXAMS_DATA && window.EXAMS_DATA.length > 0) {
    return window.EXAMS_DATA;
  }
  if (typeof EXAMS_DATA !== 'undefined' && EXAMS_DATA.length > 0) {
    return EXAMS_DATA;
  }
  return [];
}

// Khởi chạy khi load trang
document.addEventListener('DOMContentLoaded', () => {
  renderHeaderTabs();
  loadCurrentExam();
});

// Render danh sách các tab đề thi (3 đề + 1 đề tổng hợp)
function renderHeaderTabs() {
  const container = document.getElementById('examTabs');
  if (!container) return;
  const exams = getExams();
  if (exams.length === 0) return;
  
  container.innerHTML = '';
  
  exams.forEach((exam, idx) => {
    const btn = document.createElement('button');
    const isSpecial = exam.isAll;
    const icon = isSpecial ? '🔥' : (exam.type === 'image' ? '📸' : '📝');
    btn.className = `exam-tab-btn ${idx === currentExamIdx ? 'active' : ''} ${isSpecial ? 'special-tab' : ''}`;
    btn.innerHTML = `<span>${icon}</span> <span>${exam.shortTitle}</span> <span class="tab-badge">${exam.total} câu</span>`;
    btn.onclick = () => selectExam(idx);
    container.appendChild(btn);
  });
}

// Chuyển sang đề thi khác
function selectExam(idx) {
  if (currentMode === 'exam' && !examState.isSubmitted) {
    if (!confirm('Bạn đang làm dở bài thi thử, chuyển đề khác sẽ hủy bài thi hiện tại. Bạn có chắc chắn không?')) {
      return;
    }
    clearInterval(examState.timerInterval);
  }
  
  currentExamIdx = idx;
  renderHeaderTabs();
  setMode('study');
}

// Chuyển đổi giữa chế độ Ôn tập & Thi thử
function setMode(mode) {
  currentMode = mode;
  
  const btnStudy = document.getElementById('btnModeStudy');
  const btnExam = document.getElementById('btnModeExam');
  if (btnStudy) btnStudy.classList.toggle('active', mode === 'study');
  if (btnExam) btnExam.classList.toggle('active', mode === 'exam' || mode === 'review');

  if (mode === 'study') {
    clearInterval(examState.timerInterval);
    renderStudyView();
  } else if (mode === 'exam') {
    startNewExamSession();
  } else if (mode === 'review') {
    renderReviewView();
  }
}

function loadCurrentExam() {
  setMode(currentMode);
}

/* ============================================================
   CHẾ ĐỘ 1: ÔN TẬP (HIỆN CÂU HỎI VÀ ĐÁP ÁN ĐỂ HỌC THUỘC)
============================================================ */
function renderStudyView() {
  const exams = getExams();
  const exam = exams[currentExamIdx] || exams[0];
  const container = document.getElementById('appContent');
  if (!container || !exam) return;
  const isAll = !!exam.isAll;

  // Lọc câu hỏi nếu là đề tổng hợp
  let filteredQuestions = exam.questions;
  if (isAll && examState.studyFilterExam !== 'ALL') {
    filteredQuestions = exam.questions.filter(q => q.exam_code === examState.studyFilterExam);
  }

  // Thống kê phân bố đáp án A, B, C, D
  const countA = (exam.counts && exam.counts['A']) || 0;
  const countB = (exam.counts && exam.counts['B']) || 0;
  const countC = (exam.counts && exam.counts['C']) || 0;
  const countD = (exam.counts && exam.counts['D']) || 0;

  container.innerHTML = `
    <!-- Thẻ chọn Đề thi nhanh (Trực quan, dễ thấy 100%) -->
    <div class="exam-picker-container">
      <div class="exam-picker-header">
        <span class="exam-picker-title">📚 CHỌN ĐỀ THI ĐỂ ÔN TẬP / THI THỬ (HIỆN CÓ ${exams.length} BỘ ĐỀ):</span>
      </div>
      <div class="exam-picker-grid">
        ${exams.map((ex, idx) => `
          <div class="exam-picker-card ${idx === currentExamIdx ? 'active' : ''} ${ex.isAll ? 'all-card' : ''}" onclick="selectExam(${idx})">
            <div class="picker-top">
              <span class="picker-icon">${ex.isAll ? '🔥' : (ex.type === 'image' ? '📸' : '📝')}</span>
              <span class="picker-badge">${ex.total} câu</span>
            </div>
            <div class="picker-title">${ex.shortTitle}</div>
            <div class="picker-status">${idx === currentExamIdx ? '👉 Đang xem đề này' : 'Bấm để chuyển đề'}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="exam-summary-card">
      <div class="summary-header">
        <div>
          <div class="summary-title">📖 ĐANG XEM: ${exam.title}</div>
          <div class="summary-meta">Hiển thị trọn vẹn ${filteredQuestions.length} câu hỏi có sẵn đáp án đúng chuẩn 100%</div>
        </div>
        ${isAll ? `
          <div class="filter-exam-select">
            <label style="font-size: 0.85rem; color: var(--text-muted); margin-right: 8px;">Lọc theo đề gốc:</label>
            <select onchange="changeStudyFilter(this.value)" class="custom-select">
              <option value="ALL" ${examState.studyFilterExam === 'ALL' ? 'selected' : ''}>Tất cả 3 đề (${exam.total} câu)</option>
              <option value="NWC204_SU26_FE" ${examState.studyFilterExam === 'NWC204_SU26_FE' ? 'selected' : ''}>Đề 1 (SU26 FE - 50 câu)</option>
              <option value="NWC204_SU26_RE" ${examState.studyFilterExam === 'NWC204_SU26_RE' ? 'selected' : ''}>Đề 2 (SU26 RE - 50 câu)</option>
              <option value="NWC204_SP26_RE" ${examState.studyFilterExam === 'NWC204_SP26_RE' ? 'selected' : ''}>Đề 3 (SP26 RE Ảnh - 50 câu)</option>
            </select>
          </div>
        ` : ''}
      </div>
      <div class="dist-bar-group">
        <div class="dist-box"><span class="label">Đáp án A:</span> <span class="value">${countA} (${Math.round((countA / exam.total) * 100)}%)</span></div>
        <div class="dist-box"><span class="label">Đáp án B:</span> <span class="value">${countB} (${Math.round((countB / exam.total) * 100)}%)</span></div>
        <div class="dist-box"><span class="label">Đáp án C:</span> <span class="value">${countC} (${Math.round((countC / exam.total) * 100)}%)</span></div>
        <div class="dist-box"><span class="label">Đáp án D:</span> <span class="value">${countD} (${Math.round((countD / exam.total) * 100)}%)</span></div>
      </div>
    </div>

    <div class="layout-with-sidebar">
      <!-- Cột câu hỏi -->
      <div class="questions-column">
        ${filteredQuestions.map((q, idx) => renderStudyQuestionCard(q, idx + 1)).join('')}
      </div>

      <!-- Cột sidebar tra cứu nhanh -->
      <aside class="sidebar-sticky">
        <div class="sidebar-card">
          <div class="nav-grid-title">
            <span>DANH SÁCH (${filteredQuestions.length} CÂU)</span>
            <span style="color: var(--primary);">Bấm để nhảy</span>
          </div>
          <div class="nav-grid ${filteredQuestions.length > 50 ? 'dense-grid' : ''}">
            ${filteredQuestions.map((q, idx) => `
              <button class="nav-btn" onclick="scrollToQuestion('study-q-${q.id}')">
                ${idx + 1}
              </button>
            `).join('')}
          </div>
          <button class="btn-submit-exam" style="margin-top: 18px;" onclick="setMode('exam')">
            🚀 Chuyển sang Thi Thử Ngay
          </button>
        </div>
      </aside>
    </div>
  `;

  if (window.renderMathInElement) {
    renderMathInElement(container, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false}
      ]
    });
  }
}

function changeStudyFilter(val) {
  examState.studyFilterExam = val;
  renderStudyView();
}

function renderStudyQuestionCard(q, displayNum) {
  const isMulti = q.is_multi;
  const correctArr = q.correct_answer.split(',').map(s => s.trim());

  return `
    <div class="question-card" id="study-q-${q.id}">
      <div class="q-top-row">
        <div>
          <span class="q-badge">Câu ${displayNum} ${q.exam_source ? `· [${q.exam_source}]` : ''}</span>
          ${isMulti ? `<span class="badge-multi">⚡ Chọn nhiều đáp án (${q.correct_count} đáp án)</span>` : ''}
        </div>
        <span style="font-size: 0.85rem; color: var(--text-muted);">${q.chapter_name || 'NWC204'}</span>
      </div>

      ${q.content ? `<div class="q-text">${escapeHtml(q.content)}</div>` : ''}

      ${q.image_url ? `
        <div class="q-image-wrap" onclick="openLightbox('${q.image_url}')" title="Bấm vào để phóng to hình ảnh">
          <img src="${q.image_url}" loading="lazy" alt="Câu hỏi ${displayNum}">
          <div class="q-image-hint">🔍 Bấm vào ảnh để phóng to toàn màn hình</div>
        </div>
      ` : ''}

      <div class="options-container">
        ${q.options.map(opt => {
          const isCorrect = opt.is_correct || correctArr.includes(opt.label);
          return `
            <div class="option-row ${isCorrect ? 'is-correct-ans' : ''}">
              <div class="option-letter">${opt.label}</div>
              <div class="option-body">${escapeHtml(opt.content || '')}</div>
              ${isCorrect ? `<span class="answer-pill correct">✓ ĐÁP ÁN ĐÚNG</span>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ============================================================
   CHẾ ĐỘ 2: THI THỬ (TRÁO CÂU, TÙY CHỌN 50/100/150 CÂU, CHẤM ĐIỂM)
============================================================ */
function startNewExamSession(customCount) {
  const exams = getExams();
  const exam = exams[currentExamIdx] || exams[0];
  const isAll = !!exam.isAll;

  // Xác định số lượng câu thi
  let qCount = 50;
  let timeInSeconds = 3600; // 60 phút

  if (isAll) {
    qCount = customCount || examState.selectedQuestionCount || 50;
    examState.selectedQuestionCount = qCount;
    if (qCount === 150) {
      timeInSeconds = 7200; // 120 phút cho 150 câu
    } else if (qCount === 100) {
      timeInSeconds = 5400; // 90 phút cho 100 câu
    } else {
      timeInSeconds = 3600; // 60 phút cho 50 câu
    }
  } else {
    qCount = exam.questions.length;
    timeInSeconds = 3600;
  }

  // Tráo toàn bộ câu hỏi bằng Fisher-Yates
  const pool = [...exam.questions];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  examState.shuffledQuestions = pool.slice(0, qCount);
  examState.userAnswers = {};
  examState.flaggedQuestions = {};
  examState.isSubmitted = false;
  examState.score = 0;
  examState.timeRemaining = timeInSeconds;
  examState.filterWrongOnly = false;

  // Bắt đầu đếm ngược
  clearInterval(examState.timerInterval);
  examState.timerInterval = setInterval(() => {
    examState.timeRemaining--;
    updateTimerDisplay();
    if (examState.timeRemaining <= 0) {
      clearInterval(examState.timerInterval);
      alert('⏰ Đã hết thời gian làm bài! Hệ thống sẽ tự động thu bài và chấm điểm.');
      submitExam();
    }
  }, 1000);

  renderExamView();
}

function updateTimerDisplay() {
  const el = document.getElementById('examTimer');
  if (!el) return;
  const m = Math.floor(examState.timeRemaining / 60);
  const s = examState.timeRemaining % 60;
  el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  
  if (examState.timeRemaining <= 300) {
    el.style.color = 'var(--danger)';
    el.classList.add('urgent-pulse');
  } else {
    el.style.color = 'var(--primary)';
    el.classList.remove('urgent-pulse');
  }
}

function renderExamView() {
  const exams = getExams();
  const exam = exams[currentExamIdx] || exams[0];
  const container = document.getElementById('appContent');
  const isAll = !!exam.isAll;
  const total = examState.shuffledQuestions.length;

  container.innerHTML = `
    <!-- Thẻ chọn Đề thi nhanh trong chế độ Thi thử -->
    <div class="exam-picker-container" style="margin-bottom: 16px;">
      <div class="exam-picker-grid">
        ${exams.map((ex, idx) => `
          <div class="exam-picker-card ${idx === currentExamIdx ? 'active' : ''} ${ex.isAll ? 'all-card' : ''}" onclick="selectExam(${idx})">
            <div class="picker-top">
              <span class="picker-icon">${ex.isAll ? '🔥' : (ex.type === 'image' ? '📸' : '📝')}</span>
              <span class="picker-badge">${ex.total} câu</span>
            </div>
            <div class="picker-title">${ex.shortTitle}</div>
            <div class="picker-status">${idx === currentExamIdx ? '👉 Đang thi đề này' : 'Bấm để thi đề này'}</div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="exam-header-sticky">
      <div class="exam-header-content">
        <div class="exam-title-group">
          <h2>${exam.title}</h2>
          <div class="exam-sub">
            Thi thử ngẫu nhiên <strong>${total}</strong> câu hỏi · Đã làm: <span id="answeredCount">0</span>/${total} câu
          </div>
        </div>

        <div class="exam-meta-actions">
          ${isAll ? `
            <div class="q-count-picker">
              <label>Số câu thi:</label>
              <select onchange="startNewExamSession(parseInt(this.value))" class="custom-select">
                <option value="50" ${examState.selectedQuestionCount === 50 ? 'selected' : ''}>50 Câu (60 phút)</option>
                <option value="100" ${examState.selectedQuestionCount === 100 ? 'selected' : ''}>100 Câu (90 phút)</option>
                <option value="150" ${examState.selectedQuestionCount === 150 ? 'selected' : ''}>Toàn bộ 150 Câu (120 phút)</option>
              </select>
            </div>
          ` : ''}

          <div class="timer-box">
            <span>⏱️ Còn lại:</span>
            <strong id="examTimer" class="timer-text">--:--</strong>
          </div>

          <button class="btn-submit-exam" onclick="confirmSubmitExam()">
            ✅ Nộp Bài Thi
          </button>
        </div>
      </div>
    </div>

    <div class="layout-with-sidebar">
      <!-- Cột câu hỏi làm bài -->
      <div class="questions-column">
        ${examState.shuffledQuestions.map((q, idx) => renderExamQuestionCard(q, idx + 1)).join('')}
      </div>

      <!-- Cột sidebar trạng thái và palette nhảy câu -->
      <aside class="sidebar-sticky">
        <div class="sidebar-card">
          <div class="nav-grid-title">
            <span>BẢNG CÂU HỎI (${total})</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">
              <span style="display:inline-block;width:10px;height:10px;background:var(--primary);border-radius:2px;margin-right:2px;"></span>Đã làm
              <span style="display:inline-block;width:10px;height:10px;background:var(--warning);border-radius:2px;margin-left:6px;margin-right:2px;"></span>Cờ
            </span>
          </div>

          <div class="nav-grid ${total > 50 ? 'dense-grid' : ''}" id="examNavGrid">
            ${examState.shuffledQuestions.map((q, idx) => `
              <button class="nav-btn" id="nav-btn-${q.id}" onclick="scrollToQuestion('exam-q-${q.id}')">
                ${idx + 1}
              </button>
            `).join('')}
          </div>

          <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px;">
            <button class="btn-submit-exam" onclick="confirmSubmitExam()">
              🚀 Nộp Bài Thi Ngay
            </button>
            <button class="btn-secondary" onclick="restartExam()">
              🔄 Bắt đầu lại (Tráo mới)
            </button>
          </div>
        </div>
      </aside>
    </div>
  `;

  updateTimerDisplay();
  updateNavGridState();

  if (window.renderMathInElement) {
    renderMathInElement(container, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false}
      ]
    });
  }
}

function renderExamQuestionCard(q, displayNum) {
  const isMulti = q.is_multi;
  const userChoices = examState.userAnswers[q.id] || [];

  return `
    <div class="question-card" id="exam-q-${q.id}">
      <div class="q-top-row">
        <div>
          <span class="q-badge">Câu ${displayNum} ${q.exam_source ? `· [${q.exam_source}]` : ''}</span>
          ${isMulti ? `<span class="badge-multi">⚡ Chọn nhiều đáp án (${q.correct_count} đáp án)</span>` : '<span style="font-size:0.8rem;color:var(--text-muted);margin-left:8px;">(Chọn 1 đáp án)</span>'}
        </div>
        <button class="btn-flag ${examState.flaggedQuestions[q.id] ? 'active' : ''}" onclick="toggleFlag('${q.id}')" title="Cắm cờ câu này để xem lại sau">
          🚩 Đặt cờ
        </button>
      </div>

      ${q.content ? `<div class="q-text">${escapeHtml(q.content)}</div>` : ''}

      ${q.image_url ? `
        <div class="q-image-wrap" onclick="openLightbox('${q.image_url}')" title="Bấm vào để phóng to hình ảnh">
          <img src="${q.image_url}" loading="lazy" alt="Câu hỏi ${displayNum}">
          <div class="q-image-hint">🔍 Bấm vào ảnh để phóng to toàn màn hình</div>
        </div>
      ` : ''}

      <div class="options-container">
        ${q.options.map(opt => {
          const isSelected = userChoices.includes(opt.label);
          return `
            <div class="option-row ${isSelected ? 'selected' : ''}" onclick="selectAnswer('${q.id}', '${opt.label}', ${isMulti})">
              ${isMulti ? `<span class="option-checkbox-indicator">${isSelected ? '✓' : ''}</span>` : ''}
              <div class="option-letter">${opt.label}</div>
              <div class="option-body">${escapeHtml(opt.content || '')}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function selectAnswer(questionId, optionLabel, isMulti) {
  if (examState.isSubmitted) return;
  
  if (isMulti) {
    let currentChoices = examState.userAnswers[questionId] || [];
    if (currentChoices.includes(optionLabel)) {
      currentChoices = currentChoices.filter(item => item !== optionLabel);
    } else {
      currentChoices.push(optionLabel);
    }
    currentChoices.sort();
    
    if (currentChoices.length > 0) {
      examState.userAnswers[questionId] = currentChoices;
    } else {
      delete examState.userAnswers[questionId];
    }
  } else {
    // Single choice
    examState.userAnswers[questionId] = [optionLabel];
  }
  
  const card = document.getElementById(`exam-q-${questionId}`);
  if (card) {
    const userChoices = examState.userAnswers[questionId] || [];
    card.classList.toggle('answered', userChoices.length > 0);
    card.querySelectorAll('.option-row').forEach(row => {
      const label = row.querySelector('.option-letter').textContent.trim();
      const isSelected = userChoices.includes(label);
      row.classList.toggle('selected', isSelected);
      const indicator = row.querySelector('.option-checkbox-indicator');
      if (indicator) {
        indicator.textContent = isSelected ? '✓' : '';
      }
    });
  }

  updateNavGridState();
}

function toggleFlag(questionId) {
  examState.flaggedQuestions[questionId] = !examState.flaggedQuestions[questionId];
  const card = document.getElementById(`exam-q-${questionId}`);
  if (card) {
    card.classList.toggle('flagged', examState.flaggedQuestions[questionId]);
    const flagBtn = card.querySelector('.btn-flag');
    if (flagBtn) {
      flagBtn.classList.toggle('active', examState.flaggedQuestions[questionId]);
    }
  }
  updateNavGridState();
}

function updateNavGridState() {
  const answeredCountEl = document.getElementById('answeredCount');
  let answeredNum = 0;
  const total = examState.shuffledQuestions.length;

  examState.shuffledQuestions.forEach((q, idx) => {
    const btn = document.getElementById(`nav-btn-${q.id}`);
    if (!btn) return;

    const userAns = examState.userAnswers[q.id];
    const isAnswered = Array.isArray(userAns) ? userAns.length > 0 : !!userAns;
    const isFlagged = !!examState.flaggedQuestions[q.id];

    if (isAnswered) answeredNum++;

    btn.className = 'nav-btn';
    if (isAnswered) btn.classList.add('answered');
    if (isFlagged) btn.classList.add('flagged');
  });

  if (answeredCountEl) {
    answeredCountEl.textContent = answeredNum;
  }
}

function confirmSubmitExam() {
  const total = examState.shuffledQuestions.length;
  let answeredNum = 0;
  examState.shuffledQuestions.forEach(q => {
    const ans = examState.userAnswers[q.id];
    if (Array.isArray(ans) ? ans.length > 0 : !!ans) answeredNum++;
  });
  const unanswered = total - answeredNum;

  let msg = `Bạn đã hoàn thành ${answeredNum}/${total} câu hỏi.`;
  if (unanswered > 0) {
    msg += `\n⚠️ CẢNH BÁO: Còn ${unanswered} câu chưa trả lời!\nBạn có chắc chắn muốn nộp bài ngay bây giờ?`;
  } else {
    msg += `\nBạn có muốn nộp bài và xem điểm số ngay?`;
  }

  if (confirm(msg)) {
    submitExam();
  }
}

function submitExam() {
  clearInterval(examState.timerInterval);
  examState.isSubmitted = true;

  let correctCount = 0;
  examState.shuffledQuestions.forEach(q => {
    const userChoices = examState.userAnswers[q.id] || [];
    const userChoiceStr = [...userChoices].sort().join(', ');
    if (userChoiceStr === q.correct_answer) {
      correctCount++;
    }
  });

  examState.score = correctCount;
  const total = examState.shuffledQuestions.length;
  const score10 = ((correctCount / total) * 10).toFixed(1);
  const percent = Math.round((correctCount / total) * 100);

  showResultModal(correctCount, total, score10, percent);
}

function showResultModal(correct, total, score10, percent) {
  const modal = document.getElementById('resultModal');
  const icon = document.getElementById('resIcon');
  const title = document.getElementById('resTitle');
  const scoreEl = document.getElementById('resScore');
  const subEl = document.getElementById('resSub');
  const countCorrect = document.getElementById('resCountCorrect');
  const countWrong = document.getElementById('resCountWrong');
  const countPercent = document.getElementById('resPercent');

  scoreEl.textContent = `${score10} / 10`;
  subEl.textContent = `Làm đúng ${correct} / ${total} câu hỏi`;
  countCorrect.textContent = correct;
  countWrong.textContent = total - correct;
  countPercent.textContent = `${percent}%`;

  if (percent >= 80) {
    icon.textContent = '🌟';
    title.textContent = 'XUẤT SẮC! BẠN ĐÃ NẮM RẤT VỮNG KIẾN THỨC';
  } else if (percent >= 60) {
    icon.textContent = '🎉';
    title.textContent = 'CHÚC MỪNG! BẠN ĐÃ QUA MÔN (ĐẠT CHUẨN)';
  } else if (percent >= 40) {
    icon.textContent = '⚠️';
    title.textContent = 'CẦN CỐ GẮNG HƠN! HÃY ÔN TẬP THÊM';
  } else {
    icon.textContent = '📚';
    title.textContent = 'CHƯA ĐẠT! NÊN DÀNH THỜI GIAN ÔN TẬP LẠI';
  }

  modal.classList.add('active');
}

function closeModalAndReview() {
  document.getElementById('resultModal').classList.remove('active');
  setMode('review');
}

function restartExam() {
  document.getElementById('resultModal').classList.remove('active');
  startNewExamSession();
}

/* ============================================================
   CHẾ ĐỘ 3: XEM LẠI BÀI THI & CHỈ RA CÂU SAI
============================================================ */
function renderReviewView() {
  const container = document.getElementById('appContent');
  const total = examState.shuffledQuestions.length;
  const correct = examState.score;
  const score10 = ((correct / total) * 10).toFixed(1);

  let displayQuestions = examState.shuffledQuestions;
  if (examState.filterWrongOnly) {
    displayQuestions = displayQuestions.filter(q => {
      const userChoices = examState.userAnswers[q.id] || [];
      const userChoiceStr = [...userChoices].sort().join(', ');
      return userChoiceStr !== q.correct_answer;
    });
  }

  container.innerHTML = `
    <div class="exam-header-sticky">
      <div class="exam-header-content">
        <div class="exam-title-group">
          <h2>📊 BẢNG XEM LẠI BÀI THI THỬ</h2>
          <div class="exam-sub">
            Kết quả: <strong style="color:var(--success);">${score10} / 10 điểm</strong> (${correct}/${total} câu đúng)
          </div>
        </div>

        <div class="exam-meta-actions">
          <button class="btn-filter-wrong ${examState.filterWrongOnly ? 'active' : ''}" onclick="toggleFilterWrong()">
            ${examState.filterWrongOnly ? '👁️ Xem toàn bộ bài thi' : '❌ Chỉ xem các câu làm SAI'}
          </button>
          <button class="btn-submit-exam" onclick="restartExam()">
            🔄 Thi lại đề này
          </button>
        </div>
      </div>
    </div>

    <div class="layout-with-sidebar">
      <div class="questions-column">
        ${displayQuestions.length === 0 ? `
          <div style="text-align: center; padding: 60px 20px; background: var(--card-bg); border-radius: var(--radius-lg); border: 1px solid var(--card-border);">
            <div style="font-size: 3rem; margin-bottom: 12px;">🎉</div>
            <h3 style="color: var(--success); font-size: 1.3rem;">Tuyệt vời! Bạn không làm sai câu nào!</h3>
            <p style="color: var(--text-muted); margin-top: 8px;">Tất cả câu hỏi đều đã được trả lời chính xác.</p>
          </div>
        ` : displayQuestions.map((q, idx) => renderReviewQuestionCard(q, idx + 1)).join('')}
      </div>

      <aside class="sidebar-sticky">
        <div class="sidebar-card">
          <div class="nav-grid-title">
            <span>DANH SÁCH (${total} CÂU)</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Xanh: Đúng · Đỏ: Sai</span>
          </div>

          <div class="nav-grid ${total > 50 ? 'dense-grid' : ''}">
            ${examState.shuffledQuestions.map((q, idx) => {
              const userChoices = examState.userAnswers[q.id] || [];
              const userChoiceStr = [...userChoices].sort().join(', ');
              const isCorrect = userChoiceStr === q.correct_answer;
              return `
                <button class="nav-btn ${isCorrect ? 'nav-correct' : 'nav-wrong'}" onclick="scrollToQuestion('review-q-${q.id}')">
                  ${idx + 1}
                </button>
              `;
            }).join('')}
          </div>

          <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px;">
            <button class="btn-submit-exam" onclick="restartExam()">
              🔄 Thi lại lần nữa
            </button>
            <button class="btn-secondary" onclick="setMode('study')">
              📖 Quay lại chế độ Ôn tập
            </button>
          </div>
        </div>
      </aside>
    </div>
  `;

  if (window.renderMathInElement) {
    renderMathInElement(container, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false}
      ]
    });
  }
}

function renderReviewQuestionCard(q, displayNum) {
  const userChoices = examState.userAnswers[q.id] || [];
  const userChoiceStr = [...userChoices].sort().join(', ');
  const isCorrect = userChoiceStr === q.correct_answer;
  const isMulti = q.is_multi;
  const correctArr = q.correct_answer.split(',').map(s => s.trim());

  return `
    <div class="question-card ${isCorrect ? 'review-card-correct' : 'review-card-wrong'}" id="review-q-${q.id}">
      <div class="q-top-row">
        <div>
          <span class="q-badge">Câu ${displayNum} ${q.exam_source ? `· [${q.exam_source}]` : ''}</span>
          ${isMulti ? `<span class="badge-multi">⚡ Chọn nhiều (${q.correct_count} đáp án)</span>` : ''}
          <span class="review-status-pill ${isCorrect ? 'correct' : 'wrong'}">
            ${isCorrect ? '✓ CHÍNH XÁC (+1đ)' : '✗ LÀM SAI (0đ)'}
          </span>
        </div>
        <span style="font-size: 0.85rem; color: var(--text-muted);">${q.chapter_name || 'NWC204'}</span>
      </div>

      ${q.content ? `<div class="q-text">${escapeHtml(q.content)}</div>` : ''}

      ${q.image_url ? `
        <div class="q-image-wrap" onclick="openLightbox('${q.image_url}')" title="Bấm vào để phóng to hình ảnh">
          <img src="${q.image_url}" loading="lazy" alt="Câu hỏi ${displayNum}">
          <div class="q-image-hint">🔍 Bấm vào ảnh để phóng to toàn màn hình</div>
        </div>
      ` : ''}

      <div class="options-container">
        ${q.options.map(opt => {
          const isRealCorrect = opt.is_correct || correctArr.includes(opt.label);
          const isUserPick = userChoices.includes(opt.label);

          let rowClass = '';
          let pill = '';

          if (isRealCorrect && isUserPick) {
            rowClass = 'review-correct-pick';
            pill = `<span class="answer-pill correct">✓ Bạn đã chọn đúng</span>`;
          } else if (isRealCorrect && !isUserPick) {
            rowClass = 'review-missed-pick';
            pill = `<span class="answer-pill correct">★ Đáp án chuẩn (Bị bỏ sót)</span>`;
          } else if (!isRealCorrect && isUserPick) {
            rowClass = 'review-wrong-pick';
            pill = `<span class="answer-pill wrong">✗ Bạn đã chọn sai</span>`;
          }

          return `
            <div class="option-row ${rowClass}">
              ${isMulti ? `<span class="option-checkbox-indicator" style="${isUserPick ? 'background:var(--primary);color:#0b1329;border-color:var(--primary);' : ''}">${isUserPick ? '✓' : ''}</span>` : ''}
              <div class="option-letter">${opt.label}</div>
              <div class="option-body">${escapeHtml(opt.content || '')}</div>
              ${pill}
            </div>
          `;
        }).join('')}
      </div>

      <div class="review-footer-summary">
        <div>Bạn đã chọn: <strong>${userChoiceStr || 'Chưa chọn'}</strong></div>
        <div>Đáp án đúng: <strong style="color: var(--success);">${q.correct_answer}</strong></div>
      </div>
    </div>
  `;
}

function toggleFilterWrong() {
  examState.filterWrongOnly = !examState.filterWrongOnly;
  renderReviewView();
}

function scrollToQuestion(id) {
  const el = document.getElementById(id);
  if (el) {
    const yOffset = -90; // offset header sticky
    const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({top: y, behavior: 'smooth'});
  }
}

function openLightbox(src) {
  const lightbox = document.getElementById('imageLightbox');
  const img = document.getElementById('lightboxImg');
  if (lightbox && img) {
    img.src = src;
    lightbox.classList.add('active');
  }
}

function closeLightbox(event) {
  if (event && event.target && event.target.id === 'lightboxImg') {
    return; // Don't close if clicked directly on image
  }
  const lightbox = document.getElementById('imageLightbox');
  if (lightbox) {
    lightbox.classList.remove('active');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
