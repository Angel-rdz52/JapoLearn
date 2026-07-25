# Nihongo Sensei 🎌

App de aprendizaje de japonés vía Romaji, con la misma arquitectura que **Lee Conmigo**:
frontend estático (HTML/JS/Tailwind) + funciones Edge de Supabase que llaman a la API de Groq.

## Estructura
```
index.html        → pantallas de la app (login, dashboard, paso 1-4, éxito)
app.js             → toda la lógica (screens, canvas, validaciones, llamadas a IA)
style.css          → estilos auxiliares (canvas, chips de caracteres)
supabase/functions/generate-lesson/   → genera el contenido pedagógico (texto)
supabase/functions/evaluate-stroke/   → evalúa el trazo dibujado (visión)
```

## Flujo de la app (según tu método)
1. **Selector de tema** en el dashboard: Hiragana, Katakana, Kanji básico, Pronombres,
   Frases, Acciones, Dictado. Cada uno dispara un "modo": `gramatica`, `trazos` o `dictado`.
2. **Paso 1 – Vocabulario**: la IA genera título, explicación con analogías, ≥3 ejemplos
   en Romaji + `[escritura japonesa]`, y (en modo gramática) la tabla de desglose
   Sujeto/Partícula/Objeto/Partícula/Verbo/Cortesía.
3. **Paso 2 – Construcción de oración** (solo modo gramática): el usuario escribe la
   oración completa en Romaji; se valida localmente con tolerancia a pequeños typos
   (distancia de Levenshtein), sin necesidad de otra llamada a IA.
4. **Paso 3 – Canvas de trazos**: el usuario dibuja el carácter con mouse/dedo; el
   dibujo se envía como imagen a la función `evaluate-stroke`, que usa un modelo de
   **visión** para dar un porcentaje real y feedback pedagógico (ya no es un número
   simulado, como en tu prototipo local).
5. **Quiz de reconocimiento** (modo trazos) o **Dictado** (voz japonesa vía
   `speechSynthesis` + `lang: 'ja-JP'`, el usuario escribe el romaji).
6. **Paso 4 – Cierre**: resumen, mensaje motivador, sube/baja de nivel según racha
   (igual que la lógica de niveles de Lee Conmigo), y botones "Repetir" / "Volver a temas".

El avance de nivel/estrellas se guarda en `localStorage`, igual que en el proyecto original
(no hay login real ni base de datos de usuarios).

## Configuración

### 1. Frontend
Edita en `app.js`:
```js
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';
```

### 2. Backend (Supabase Edge Functions)
```bash
supabase functions deploy generate-lesson
supabase functions deploy evaluate-stroke
supabase secrets set GROQ_API_KEY=tu_api_key_de_groq
```
Puedes reutilizar el mismo secret `GROQ_API_KEY` que ya tienes configurado para
`generate-reading` en tu proyecto de Lee Conmigo, si usas el mismo proyecto Supabase.

### 3. Modelos de Groq
El catálogo de modelos de Groq cambia con cierta frecuencia (algunos modelos se han
ido deprecando durante 2026). Antes de desplegar, revisa:
- Texto: https://console.groq.com/docs/models
- Visión: https://console.groq.com/docs/vision

Y ajusta las constantes `TEXT_MODEL` (en `generate-lesson/index.ts`) y `VISION_MODEL`
(en `evaluate-stroke/index.ts`) si esos modelos ya no están disponibles.

## Nota honesta sobre la evaluación de trazos
La evaluación usa un modelo de lenguaje con visión para "leer" la imagen del canvas y
juzgar el parecido con el carácter objetivo. Es una evaluación razonable para uso
educativo (mucho más real que un número fijo simulado), pero no es un motor
especializado de reconocimiento de trazos como los de apps dedicadas (que analizan
orden y dirección de trazos con OCR específico para kana/kanji) — puede equivocarse
en casos límite. Si más adelante quieres mayor precisión, se podría añadir una
comparación geométrica local (superposición con una plantilla vectorial del carácter)
como complemento al puntaje de la IA.

## Ejecutar localmente
Basta con servir la carpeta con cualquier servidor estático, por ejemplo:
```bash
npx serve .
```
y abrir `index.html` en el navegador.
