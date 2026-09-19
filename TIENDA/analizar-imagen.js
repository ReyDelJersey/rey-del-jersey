// netlify/functions/analizar-imagen.js
//
// Recibe { imageUrl } por POST, le pide a Claude que "vea" la foto del jersey
// y devuelve { nombre, equipo } en JSON.
//
// Variable de entorno necesaria en Netlify:
//   ANTHROPIC_API_KEY

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { imageUrl } = JSON.parse(event.body || "{}");

    if (!imageUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Falta imageUrl en el body" }),
      };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Falta ANTHROPIC_API_KEY en el entorno" }),
      };
    }

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: imageUrl } },
              {
                type: "text",
                text:
                  "Esta es la foto de un jersey/uniforme deportivo (fútbol, NBA o Fórmula 1) " +
                  "para un catálogo de tienda. Responde ÚNICAMENTE con un objeto JSON válido, " +
                  "sin texto adicional, sin markdown, con esta forma exacta: " +
                  '{"nombre": "...", "equipo": "..."}. ' +
                  "El campo 'equipo' es solo el nombre del equipo/selección/escudería que reconozcas " +
                  "por el escudo, logo o colores (ej. 'Real Madrid', 'Lakers', 'Ferrari'). " +
                  "El campo 'nombre' debe seguir el patrón 'Equipo AÑO Local/Visitante/Alternativa' " +
                  "cuando puedas distinguirlo por el diseño (ej. 'Real Madrid 24/25 Local'); " +
                  "si NO estás seguro del año o de si es local/visitante, escribe 'Equipo ?/? ?' " +
                  "dejando esa parte con signos de interrogación en vez de inventar el dato.",
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Error llamando a Anthropic", detail: errText }),
      };
    }

    const data = await anthropicResponse.json();
    const rawText = (data.content || [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    const cleanText = rawText.replace(/^```json\s*|```$/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
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
