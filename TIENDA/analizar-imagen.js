// netlify/functions/analizar-imagen.js
//
// Recibe { imageUrl } por POST, descarga la foto, se la manda a Gemini
// (Google AI, nivel gratis) y devuelve { nombre, equipo } en JSON.
//
// Variable de entorno necesaria en Netlify:
//   GEMINI_API_KEY   (gratis, sin tarjeta, desde https://aistudio.google.com/apikey)

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { imageUrl } = JSON.parse(event.body || "{}");

    if (!imageUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: "Falta imageUrl en el body" }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Falta GEMINI_API_KEY en el entorno" }) };
    }

    // 1. Descargar la foto para convertirla a base64 (Gemini la necesita así, no como link)
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No se pudo descargar la imagen desde ese link" }),
      };
    }
    const mimeType = imgResponse.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    const base64Data = buffer.toString("base64");

    // 2. Pedirle a Gemini que la analice
    const prompt =
      "Esta es la foto de un jersey/uniforme deportivo (fútbol, NBA o Fórmula 1) para un " +
      "catálogo de tienda. Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, " +
      "sin markdown, con esta forma exacta: {\"nombre\": \"...\", \"equipo\": \"...\"}. " +
      "El campo 'equipo' es solo el nombre del equipo/selección/escudería que reconozcas por el " +
      "escudo, logo o colores (ej. 'Real Madrid', 'Lakers', 'Ferrari'). El campo 'nombre' debe " +
      "seguir el patrón 'Equipo AÑO Local/Visitante/Alternativa' cuando puedas distinguirlo por " +
      "el diseño (ej. 'Real Madrid 24/25 Local'); si NO estás seguro del año o de si es " +
      "local/visitante, escribe 'Equipo ?/? ?' dejando esa parte con signos de interrogación en " +
      "vez de inventar el dato.";

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType, data: base64Data } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Error llamando a Gemini", detail: errText }),
      };
    }

    const data = await geminiResponse.json();
    const rawText =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
        ? data.candidates[0].content.parts[0].text
        : "";

    let parsed;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch (e) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "La IA no devolvió JSON válido", raw: rawText }),
      };
    }

    return { statusCode: 200, body: JSON.stringify(parsed) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
