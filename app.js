// app.js — Nihongo Sensei
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ⚠️ Reemplaza con los datos de TU proyecto de Supabase (igual que en LeeConmigo)
const SUPABASE_URL = 'https://jxlbfwaansqiwdopdwbg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JYom-Z0M4PdD056TJ9k9nA_Xrwg3CID';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentLesson = null;   // JSON devuelto por la IA
let currentModo = null;     // 'gramatica' | 'trazos' | 'dictado'
let currentTopic = null;

let charIndex = 0;          // índice del carácter que se está trazando
let quizIndex = 0;
let quizScore = 0;
let dictadoIndex = 0;
let dictadoScore = 0;
let sentenceOk = false;

// ---------- Canvas de trazos ----------
let canvas, ctx, drawing = false;

const screens = {
    login: document.getElementById('screen-login'),
    dashboard: document.getElementById('screen-dashboard'),
    vocab: document.getElementById('screen-vocab'),
    sentence: document.getElementById('screen-sentence'),
    canvas: document.getElementById('screen-canvas'),
    quiz: document.getElementById('screen-quiz'),
    dictado: document.getElementById('screen-dictado'),
    success: document.getElementById('screen-success'),
};

function showScreen(name) {
    Object.values(screens).forEach(s => {
        if (s) { s.classList.remove('screen-active'); s.classList.add('screen-hidden'); }
    });
    if (screens[name]) {
        screens[name].classList.remove('screen-hidden');
        screens[name].classList.add('screen-active');
    }
}

// ---------- Arranque / usuario local ----------
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('nihongo_sensei_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        updateDashboardUi();
        showScreen('dashboard');
    }
    initCanvas();
});

document.getElementById('btn-start').addEventListener('click', () => {
    const name = document.getElementById('input-name').value.trim();
    if (!name) { alert('Por favor, ingresa un nombre.'); return; }
    currentUser = { name, level: 1, stars: 0, success_streak: 0, fail_streak: 0 };
    localStorage.setItem('nihongo_sensei_user', JSON.stringify(currentUser));
    updateDashboardUi();
    showScreen('dashboard');
});

function updateDashboardUi() {
    if (!currentUser) return;
    document.getElementById('dash-name').innerText = `こんにちは, ${currentUser.name}`;
    document.getElementById('dash-level').innerText = currentUser.level;
    document.getElementById('dash-stars').innerText = currentUser.stars;
}

document.querySelectorAll('.topic-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentTopic = btn.getAttribute('data-topic');
        currentModo = btn.getAttribute('data-modo');
        startLesson(currentTopic, currentModo);
    });
});

document.getElementById('btn-vocab-back').addEventListener('click', () => showScreen('dashboard'));

// ---------- Generar lección con IA ----------
async function startLesson(topic, modo) {
    showScreen('vocab');
    document.getElementById('loading-vocab').classList.remove('hidden');
    document.getElementById('vocab-content').classList.add('hidden');

    charIndex = 0; quizIndex = 0; quizScore = 0; dictadoIndex = 0; dictadoScore = 0; sentenceOk = false;

    try {
        const { data, error } = await supabase.functions.invoke('generate--lesson', {
            body: { topic, modo, level: currentUser.level, streak: currentUser.success_streak }
        });
        if (error) throw new Error('Error de Supabase: ' + JSON.stringify(error));
        if (data && data.error) throw new Error('Error de la IA: ' + data.error);

        currentLesson = data;
        renderVocab(currentLesson, modo);

        document.getElementById('loading-vocab').classList.add('hidden');
        document.getElementById('vocab-content').classList.remove('hidden');
    } catch (err) {
        document.getElementById('loading-vocab').classList.add('hidden');
        alert('DIAGNÓSTICO:\n\n' + err.message);
        showScreen('dashboard');
    }
}

function renderVocab(lesson, modo) {
    document.getElementById('vocab-title').innerText = lesson.leccion_titulo || 'Lección';
    document.getElementById('vocab-explicacion').innerText = lesson.explicacion_gramatical || '';

    // Ejemplos
    const ejemplosWrap = document.getElementById('vocab-ejemplos');
    ejemplosWrap.innerHTML = '';
    (lesson.ejemplos || []).forEach(ej => {
        const div = document.createElement('div');
        div.className = 'text-sm bg-slate-50 border border-slate-200 rounded-lg p-2';
        div.innerHTML = `<b>${ej.romaji}</b> <span class="text-slate-400">[${ej.japones}]</span><br><span class="text-xs text-slate-500">${ej.significado}</span>`;
        ejemplosWrap.appendChild(div);
    });

    // Tabla de desglose (modo gramática)
    const tablaWrap = document.getElementById('vocab-tabla-wrap');
    const tablaBody = document.getElementById('vocab-tabla-body');
    tablaBody.innerHTML = '';
    if (modo === 'gramatica' && lesson.desglose && lesson.desglose.length) {
        lesson.desglose.forEach(fila => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="p-2 border border-rose-50 font-semibold">${fila.romaji}</td>
                             <td class="p-2 border border-rose-50">${fila.escritura}</td>
                             <td class="p-2 border border-rose-50">${fila.significado}</td>
                             <td class="p-2 border border-rose-50 text-slate-500">${fila.funcion}</td>`;
            tablaBody.appendChild(tr);
        });
        tablaWrap.classList.remove('hidden');
    } else {
        tablaWrap.classList.add('hidden');
    }

    // Grid de caracteres (modo trazos)
    const charsWrap = document.getElementById('vocab-chars-wrap');
    const charsGrid = document.getElementById('vocab-chars-grid');
    charsGrid.innerHTML = '';
    if ((modo === 'trazos' || modo === 'gramatica') && lesson.caracteres_practica && lesson.caracteres_practica.length) {
        lesson.caracteres_practica.forEach(c => {
            const chip = document.createElement('div');
            chip.className = 'char-chip';
            chip.innerHTML = `<span class="chip-char">${c.caracter}</span><span class="chip-romaji">${c.romaji}</span>`;
            charsGrid.appendChild(chip);
        });
        charsWrap.classList.remove('hidden');
    } else {
        charsWrap.classList.add('hidden');
    }
}

document.getElementById('btn-vocab-next').addEventListener('click', () => {
    if (currentModo === 'gramatica') {
        renderSentenceStep();
        showScreen('sentence');
    } else if (currentModo === 'trazos') {
        charIndex = 0;
        renderCanvasStep();
        showScreen('canvas');
    } else if (currentModo === 'dictado') {
        dictadoIndex = 0;
        renderDictadoStep();
        showScreen('dictado');
    }
});

// ---------- PASO 2: Oración (modo gramática) ----------
function renderSentenceStep() {
    const hint = document.getElementById('sentence-hint');
    const pistas = (currentLesson.desglose || []).map(f => f.romaji).join(' + ');
    hint.innerText = pistas ? `Pistas: ${pistas}` : '';
    document.getElementById('sentence-input').value = '';
    document.getElementById('sentence-feedback').classList.add('hidden');
    document.getElementById('btn-sentence-check').classList.remove('hidden');
    document.getElementById('btn-sentence-next').classList.add('hidden');
}

function normalizar(txt) {
    return txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[¿?¡!.,]/g, '').replace(/\s+/g, ' ').trim();
}

// Distancia de Levenshtein simple para tolerar pequeños errores de tipeo
function levenshtein(a, b) {
    const m = [];
    for (let i = 0; i <= b.length; i++) m[i] = [i];
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            m[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
                ? m[i - 1][j - 1]
                : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
        }
    }
    return m[b.length][a.length];
}

document.getElementById('btn-sentence-check').addEventListener('click', () => {
    const objetivo = normalizar(currentLesson.oracion_objetivo.romaji);
    const intento = normalizar(document.getElementById('sentence-input').value);
    const dist = levenshtein(objetivo, intento);
    const tolerancia = Math.max(2, Math.floor(objetivo.length * 0.12));
    const feedback = document.getElementById('sentence-feedback');
    feedback.classList.remove('hidden');

    if (intento && dist <= tolerancia) {
        sentenceOk = true;
        feedback.className = 'text-center font-bold text-sm p-2 rounded-lg bg-emerald-50 text-emerald-700';
        feedback.innerText = `¡Correcto! 🌟  ${currentLesson.oracion_objetivo.romaji} [${currentLesson.oracion_objetivo.japones}]`;
        document.getElementById('btn-sentence-check').classList.add('hidden');
        document.getElementById('btn-sentence-next').classList.remove('hidden');
    } else {
        sentenceOk = false;
        feedback.className = 'text-center font-bold text-sm p-2 rounded-lg bg-amber-50 text-amber-700';
        feedback.innerText = 'Casi... revisa el orden de las partículas e inténtalo de nuevo.';
    }
});

document.getElementById('btn-sentence-next').addEventListener('click', () => {
    charIndex = 0;
    renderCanvasStep();
    showScreen('canvas');
});

// ---------- PASO 3: Canvas de trazos ----------
function initCanvas() {
    canvas = document.getElementById('trace-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';

    const pos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };
    const start = (e) => { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
    const move = (e) => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
    const end = () => { drawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
}

function clearCanvas() {
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function renderCanvasStep() {
    const chars = currentLesson.caracteres_practica || [];
    if (!chars.length) { goToNextAfterCanvas(); return; }
    const c = chars[charIndex];
    document.getElementById('canvas-target-char').innerText = c.caracter;
    document.getElementById('canvas-target-romaji').innerText = c.romaji;
    document.getElementById('canvas-guide').innerText = c.caracter;
    document.getElementById('canvas-progress').innerText = `${charIndex + 1}/${chars.length}`;
    clearCanvas();
    document.getElementById('canvas-feedback').classList.add('hidden');
    document.getElementById('canvas-evaluating').classList.add('hidden');
    document.getElementById('btn-canvas-next').classList.add('hidden');
    document.getElementById('btn-canvas-check').classList.remove('hidden');
}

document.getElementById('btn-canvas-clear').addEventListener('click', clearCanvas);

document.getElementById('btn-canvas-check').addEventListener('click', async () => {
    const chars = currentLesson.caracteres_practica || [];
    const c = chars[charIndex];

    document.getElementById('canvas-evaluating').classList.remove('hidden');
    document.getElementById('canvas-feedback').classList.add('hidden');
    document.getElementById('btn-canvas-check').classList.add('hidden');

    try {
        const resultado = await evaluarTrazoLocal(c.caracter);
        document.getElementById('canvas-evaluating').classList.add('hidden');
        document.getElementById('canvas-score').innerText = resultado.porcentaje;
        document.getElementById('canvas-feedback-text').innerText = resultado.feedback;
        document.getElementById('canvas-feedback').classList.remove('hidden');
        document.getElementById('btn-canvas-next').classList.remove('hidden');
    } catch (err) {
        document.getElementById('canvas-evaluating').classList.add('hidden');
        document.getElementById('btn-canvas-check').classList.remove('hidden');
        alert('DIAGNÓSTICO:\n\n' + err.message);
    }
});

// ---------- Evaluación local del trazo (sin IA, sin tokens) ----------
// Compara el dibujo del usuario contra el carácter renderizado con una fuente
// japonesa real, usando una rejilla de celdas con tolerancia de alineación.
const GRID = 52;             // celdas por lado (260px / 5)
const TOLERANCIA_CELDAS = 2; // radio de tolerancia al comparar celdas
const referenceMaskCache = new Map();

async function ensureFontLoaded() {
    if (document.fonts && document.fonts.load) {
        try { await document.fonts.load('700 200px "Noto Sans JP"'); } catch (e) { /* fuente no disponible, se usa fallback */ }
    }
}

function buildMaskFromImageData(imageData, w, h) {
    const cellW = w / GRID, cellH = h / GRID;
    const mask = new Array(GRID * GRID).fill(false);
    for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
            let inked = false;
            outer:
            for (let py = Math.floor(gy * cellH); py < Math.floor((gy + 1) * cellH); py += 2) {
                for (let px = Math.floor(gx * cellW); px < Math.floor((gx + 1) * cellW); px += 2) {
                    const idx = (py * w + px) * 4;
                    const alpha = imageData.data[idx + 3];
                    if (alpha > 100) { inked = true; break outer; }
                }
            }
            mask[gy * GRID + gx] = inked;
        }
    }
    return mask;
}

async function getReferenceMask(char) {
    if (referenceMaskCache.has(char)) return referenceMaskCache.get(char);
    await ensureFontLoaded();

    const off = document.createElement('canvas');
    off.width = 260; off.height = 260;
    const octx = off.getContext('2d');
    octx.clearRect(0, 0, 260, 260);
    octx.fillStyle = '#000000';
    octx.font = '700 190px "Noto Sans JP", sans-serif';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillText(char, 130, 138);

    const imageData = octx.getImageData(0, 0, 260, 260);
    const mask = buildMaskFromImageData(imageData, 260, 260);
    referenceMaskCache.set(char, mask);
    return mask;
}

function cellHasNeighborInked(mask, gx, gy, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = gx + dx, ny = gy + dy;
            if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
            if (mask[ny * GRID + nx]) return true;
        }
    }
    return false;
}

async function evaluarTrazoLocal(targetChar) {
    const refMask = await getReferenceMask(targetChar);
    const userImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const userMask = buildMaskFromImageData(userImageData, canvas.width, canvas.height);

    let refInkCount = 0, coveredCount = 0;
    let userInkCount = 0, precisionCount = 0;

    for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
            const i = gy * GRID + gx;
            if (refMask[i]) {
                refInkCount++;
                if (cellHasNeighborInked(userMask, gx, gy, TOLERANCIA_CELDAS)) coveredCount++;
            }
            if (userMask[i]) {
                userInkCount++;
                if (cellHasNeighborInked(refMask, gx, gy, TOLERANCIA_CELDAS)) precisionCount++;
            }
        }
    }

    if (userInkCount < 5) {
        return { porcentaje: 0, feedback: 'No detecté ningún trazo. Dibuja el carácter dentro del recuadro.' };
    }

    const cobertura = refInkCount ? coveredCount / refInkCount : 0;
    const precision = userInkCount ? precisionCount / userInkCount : 0;
    const score = Math.round((0.6 * cobertura + 0.4 * precision) * 100);

    let feedback;
    if (score >= 85) {
        feedback = '¡Excelente trazo! La forma y proporción se ven muy bien.';
    } else if (cobertura < 0.6 && precision >= 0.6) {
        feedback = 'Vas por buen camino, pero te falta cubrir parte del carácter. Revisa que dibujes todos los trazos.';
    } else if (precision < 0.6 && cobertura >= 0.6) {
        feedback = 'Cubriste bien la forma, pero te saliste bastante de los límites. Intenta trazos más contenidos.';
    } else if (score >= 70) {
        feedback = 'Buen intento, se reconoce el carácter. Sigue practicando la proporción.';
    } else {
        feedback = 'Aún no se parece lo suficiente al carácter objetivo. Observa su forma con calma e inténtalo de nuevo.';
    }

    return { porcentaje: score, feedback };
}

document.getElementById('btn-canvas-next').addEventListener('click', () => {
    const chars = currentLesson.caracteres_practica || [];
    charIndex++;
    if (charIndex < chars.length) {
        renderCanvasStep();
    } else {
        goToNextAfterCanvas();
    }
});

function goToNextAfterCanvas() {
    if (currentModo === 'trazos' && currentLesson.quiz_reconocimiento && currentLesson.quiz_reconocimiento.length) {
        quizIndex = 0; quizScore = 0;
        renderQuiz();
        showScreen('quiz');
    } else {
        finishSession();
    }
}

// ---------- QUIZ de reconocimiento (modo trazos) ----------
function renderQuiz() {
    const preguntas = currentLesson.quiz_reconocimiento || [];
    if (quizIndex >= preguntas.length) { finishSession(); return; }
    const q = preguntas[quizIndex];
    document.getElementById('quiz-title').innerText = `Pregunta ${quizIndex + 1} de ${preguntas.length}`;
    document.getElementById('quiz-question').innerText = q.pregunta;

    const container = document.getElementById('quiz-options');
    container.innerHTML = '';
    const feedback = document.getElementById('quiz-feedback');
    feedback.classList.add('hidden');

    q.opciones.forEach(op => {
        const btn = document.createElement('button');
        btn.className = 'option-btn w-full p-3 text-left border border-slate-200 rounded-xl font-medium hover:bg-slate-50 transition text-sm';
        btn.innerText = op;
        btn.onclick = () => checkQuizAnswer(btn, op, q.respuesta_correcta);
        container.appendChild(btn);
    });
}

function checkQuizAnswer(btn, selected, correct) {
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
    const feedback = document.getElementById('quiz-feedback');
    feedback.classList.remove('hidden');

    if (selected.trim().toLowerCase() === correct.trim().toLowerCase()) {
        btn.classList.add('correct');
        feedback.innerText = '¡Correcto! 🌟';
        feedback.className = 'mt-2 text-lg font-bold text-center text-green-500';
        quizScore++;
    } else {
        btn.classList.add('incorrect');
        document.querySelectorAll('.option-btn').forEach(b => {
            if (b.innerText.trim().toLowerCase() === correct.trim().toLowerCase()) b.classList.add('correct');
        });
        feedback.innerText = `Casi... era: "${correct}"`;
        feedback.className = 'mt-2 text-base font-bold text-center text-red-500';
    }

    setTimeout(() => { quizIndex++; renderQuiz(); }, 1800);
}

// ---------- DICTADO ----------
function renderDictadoStep() {
    const palabras = currentLesson.palabras || [];
    if (dictadoIndex >= palabras.length) { finishSession(); return; }
    document.getElementById('dictado-title').innerText = `Palabra ${dictadoIndex + 1} de ${palabras.length}`;
    document.getElementById('dictado-input').value = '';
    document.getElementById('dictado-feedback').classList.add('hidden');
    document.getElementById('btn-dictado-check').classList.remove('hidden');
    document.getElementById('btn-dictado-next').classList.add('hidden');
}

document.getElementById('btn-dictado-play').addEventListener('click', () => {
    const palabras = currentLesson.palabras || [];
    const p = palabras[dictadoIndex];
    if (!p) return;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(p.japones);
        u.lang = 'ja-JP';
        u.rate = 0.8;
        window.speechSynthesis.speak(u);
    } else {
        alert('Tu navegador no soporta lectura en voz alta.');
    }
});

document.getElementById('btn-dictado-check').addEventListener('click', () => {
    const palabras = currentLesson.palabras || [];
    const p = palabras[dictadoIndex];
    const objetivo = normalizar(p.romaji);
    const intento = normalizar(document.getElementById('dictado-input').value);
    const dist = levenshtein(objetivo, intento);
    const tolerancia = Math.max(1, Math.floor(objetivo.length * 0.15));
    const feedback = document.getElementById('dictado-feedback');
    feedback.classList.remove('hidden');

    if (intento && dist <= tolerancia) {
        dictadoScore++;
        feedback.className = 'text-center font-bold text-sm p-2 rounded-lg bg-emerald-50 text-emerald-700';
        feedback.innerText = `¡Correcto! 🌟 ${p.romaji} [${p.japones}] = ${p.significado}`;
    } else {
        feedback.className = 'text-center font-bold text-sm p-2 rounded-lg bg-red-50 text-red-700';
        feedback.innerText = `Era: ${p.romaji} [${p.japones}] = ${p.significado}`;
    }
    document.getElementById('btn-dictado-check').classList.add('hidden');
    document.getElementById('btn-dictado-next').classList.remove('hidden');
});

document.getElementById('btn-dictado-next').addEventListener('click', () => {
    dictadoIndex++;
    const palabras = currentLesson.palabras || [];
    if (dictadoIndex < palabras.length) {
        renderDictadoStep();
    } else {
        finishSession();
    }
});

// ---------- PASO 4: Cierre ----------
function finishSession() {
    showScreen('success');

    let resumen = '';
    let puntosGanados = 0;

    if (currentModo === 'gramatica') {
        puntosGanados = sentenceOk ? 3 : 1;
        resumen = sentenceOk ? 'Oración correcta + trazo practicado' : 'Trazo practicado';
    } else if (currentModo === 'trazos') {
        const total = (currentLesson.quiz_reconocimiento || []).length;
        puntosGanados = quizScore;
        resumen = total ? `Aciertos: ${quizScore}/${total}` : 'Caracteres practicados';
    } else if (currentModo === 'dictado') {
        const total = (currentLesson.palabras || []).length;
        puntosGanados = dictadoScore;
        resumen = `Aciertos: ${dictadoScore}/${total}`;
    }

    document.getElementById('success-summary').innerText = resumen;

    // Progresión simple de nivel por rachas de éxito
    let levelMsg = '¡Sigue practicando, lo estás haciendo genial!';
    const buenaSesion = puntosGanados >= 2;

    if (buenaSesion) {
        currentUser.success_streak = (currentUser.success_streak || 0) + 1;
        currentUser.fail_streak = 0;
        if (currentUser.success_streak >= 3 && currentUser.level < 10) {
            currentUser.level++;
            currentUser.success_streak = 0;
            levelMsg = '¡Felicidades! Subiste de nivel 🚀 [レベルアップ]';
        }
    } else {
        currentUser.fail_streak = (currentUser.fail_streak || 0) + 1;
        currentUser.success_streak = 0;
        if (currentUser.fail_streak >= 2 && currentUser.level > 1) {
            currentUser.level--;
            currentUser.fail_streak = 0;
            levelMsg = 'Vamos a practicar un poco más este nivel. 💪';
        }
    }

    currentUser.stars = (currentUser.stars || 0) + puntosGanados;
    document.getElementById('success-msg').innerText = levelMsg;
    localStorage.setItem('nihongo_sensei_user', JSON.stringify(currentUser));
}

document.getElementById('btn-repeat').addEventListener('click', () => {
    startLesson(currentTopic, currentModo);
});

document.getElementById('btn-home').addEventListener('click', () => {
    updateDashboardUi();
    showScreen('dashboard');
});
