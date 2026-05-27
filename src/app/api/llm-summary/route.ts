import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert SaaS cost analyst. Given the provided AI usage audit JSON, produce a short, executive-style summary. RETURN ONLY A SINGLE VALID JSON OBJECT (no surrounding text) using the exact schema below.

Schema:
{
  "title": string,                        // one-line title for the summary
  "totalMonthlySavings": string,         // human-friendly, e.g. "$8/month"
  "highestROITool": string,              // tool name with short reason
  "strategicRecommendations": [          // 1-3 recommendation objects
    {
      "title": string,                   // short recommendation title
      "cause": string,                   // why this change is needed (1-2 sentences)
      "benefit": string,                 // quantified financial or operational benefit
      "notes"?: string                   // optional short implementation note
    }
  ]
}

Requirements:
- Return only valid JSON following the schema above. Do not include markdown, explanation, or any text outside the single JSON object.
- Keep all text concise and executive; prefer short sentences and bullet-friendly phrasing inside the strings.
- Where monetary values exist, format like "$123/month".
- Provide 1-2 strategicRecommendations when available.
`;

    const input = JSON.stringify(body);

    const configuredModel = process.env.GEMINI_MODEL?.trim();
    const candidateModels = [configuredModel, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
      .filter((model, index, all) => Boolean(model) && all.indexOf(model) === index) as string[];

    let lastError: unknown = null;

    // Add an additional fallback (text-bison) which is often available when flash models are busy.
    const extendedCandidates = [...candidateModels, "text-bison@001"].filter(Boolean) as string[];

    for (const modelName of extendedCandidates) {
      // For transient errors (503/unavailable) we'll retry a few times with exponential backoff.
      const maxAttempts = 3;
      let attempt = 0;
      let lastAttemptError: unknown = null;

      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          const resp = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [{ text: `Audit JSON:\n${input}` }],
              },
            ],
            config: {
              systemInstruction: prompt,
              temperature: 0.6,
              maxOutputTokens: 2000,
            },
          });

          const summaryText = resp.text?.trim() ?? "";
          if (!summaryText) {
            return NextResponse.json(
              { error: "No text generated. The request may have been blocked by safety filters.", model: modelName },
              { status: 400 }
            );
          }

          // Try to parse the model output as JSON following the schema
          let parsed: any = null;
          let parseError: string | null = null;
          try {
            parsed = JSON.parse(summaryText);
          } catch (e) {
            // Attempt to extract a JSON object substring if the model included extra text
            const maybe = summaryText.match(/\{[\s\S]*\}/);
            if (maybe) {
              try {
                parsed = JSON.parse(maybe[0]);
              } catch (e2) {
                parseError = String(e2);
              }
            } else {
              parseError = String(e);
            }
          }

          if (parsed) {
            return NextResponse.json({ summary: parsed, model: modelName });
          }

          // If parsing failed, return the raw text plus a helpful parseError for debugging
          return NextResponse.json({ summaryText, model: modelName, parseError }, { status: 200 });
        } catch (err) {
          lastAttemptError = err;
          const message = err instanceof Error ? err.message : String(err);

          // If the model is not found or unsupported, stop retrying this model and try next.
          if (/not found|not supported|404|ModelService\.ListModels/i.test(message)) {
            lastError = err;
            break;
          }

          // If it's an UNAVAILABLE/503/high demand, retry with backoff.
          if (/503|UNAVAILABLE|high demand|busy|temporar/i.test(message)) {
            const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
            await new Promise((r) => setTimeout(r, backoffMs));
            continue; // retry
          }

          // For other errors, record and break out to return a helpful message.
          lastError = err;
          break;
        }
      }

      // If we exhausted attempts for this model, move to next candidate (but keep lastError)
      if (lastAttemptError) lastError = lastAttemptError;
    }

    return NextResponse.json(
      {
        error:
          lastError instanceof Error ? lastError.message : String(lastError ?? "Unable to generate summary with Gemini"),
        hint: `Check GEMINI_MODEL and choose one of the available models for your account. Tried: ${candidateModels.join(", ")}`,
      },
      { status: 404 }
    );
    
  } catch (err: any) {
    console.error("Gemini Generation Error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}