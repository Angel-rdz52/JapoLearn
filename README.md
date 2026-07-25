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
