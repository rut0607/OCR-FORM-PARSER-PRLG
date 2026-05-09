const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function convertToJSON(markdownTable) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a highly precise Data Structuring Assistant specializing in manufacturing logbook digitization. Your task is to convert a raw Markdown table into a strict, validated JSON array.

CRITICAL INSTRUCTIONS & VALIDATION RULES:

1. JSON STRUCTURE: Output a JSON array of objects. Each object = one row.

2. EXACT KEYS: Use these exact keys for every object:
   "NO", "Job", "Sn_No", "Actual_Weight", "After_Core_Weight", "Core_Scrap", "X_and_Y"

3. BLANK CELLS: If a cell is empty, whitespace-only, or a stray artifact (dot, dash), output null for that key.

4. Sn_No FIELD RULES:
   - Sn_No is a 7-digit serial number. Valid range: 1000000 to 9999999.
   - If OCR produces 8+ digits (e.g. "12276152"), it likely merged two characters — find the most plausible 7-digit number.
   - If OCR produces 6 digits (e.g. "068671"), a leading digit was dropped — use context from nearby rows to guess the missing digit. Serial numbers in the same batch are usually close to each other.
   - Never output more than 7 digits for Sn_No unless you are absolutely certain.

5. NUMERIC FIELDS — Actual_Weight, After_Core_Weight:
   - These are weights typically between 9.00 and 25.00.
   - Only digits 0-9 and ONE decimal point are valid.
   - If a comma appears instead of decimal point, replace it (e.g. "10,66" → 10.66).
   - Output as a numeric float.

6. Core_Scrap FIELD RULES — CRITICAL:
   - Core_Scrap values are ALWAYS small numbers between 0.10 and 1.50.
   - They ALWAYS start with 0. (zero point something) — NEVER a whole number like 3, 8, or 5.
   - If OCR reads "3.63", "8.76", "8.53" — these are WRONG. The leading digit is always 0.
   - Correct by replacing the first digit with 0: "3.63" → 0.63, "8.76" → 0.76, "8.53" → 0.53.
   - If a comma appears instead of decimal point, replace it.
   - Output as a numeric float.

7. X_and_Y FIELD RULES:
   - Always contains exactly two decimal numbers separated by x or X (e.g. "18.96x18.98").
   - Both numbers are dimensions typically between 18.00 and 21.00.
   - Valid characters: digits 0-9, decimal point, lowercase x as separator only.
   - If a comma appears instead of decimal point, replace it.
   - Each number has exactly 2 decimal places.
   - Always use lowercase x as separator in output.
   - Output as a string (e.g. "18.96x18.98").
   - Make sure each row's X_and_Y matches THAT row — do not shift values between rows.

8. BEST GUESS RULE:
   - Handwritten logbooks have overlapping digits, smudges, unclear characters.
   - Always attempt a best-guess correction using the context ranges above.
   - Only output null as a last resort when truly impossible to determine.

9. ROW INTEGRITY RULE — CRITICAL:
   - Every value in a row belongs to THAT row only.
   - Never copy or shift a value from one row to another.
   - If unsure about a value, use the range context clues above to pick the most likely correct value.

10. STRICT OUTPUT: Return ONLY the raw JSON string. No markdown formatting, no code fences, no preamble. Start immediately with [ and end with ].

RAW MARKDOWN TABLE:
${markdownTable}`;

  let raw = "";

  try {
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    throw new Error(`Gemini API call failed: ${err.message}`);
  }

  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(stripped);
    if (!Array.isArray(parsed)) {
      throw new Error("Gemini response parsed but is not an array");
    }
    return parsed;
  } catch (parseErr) {
    throw new Error(
      `Gemini returned invalid JSON: ${parseErr.message}\n\nRAW OUTPUT:\n${raw}`
    );
  }
}

module.exports = { convertToJSON };
