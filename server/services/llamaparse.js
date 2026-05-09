const axios = require("axios");
const FormData = require("form-data");

const LLAMA_BASE = "https://api.cloud.llamaindex.ai/api/v1/parsing";
const MAX_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 4000;

async function parseImageToMarkdown(fileBuffer, fileName) {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;

  // Step 1: Upload
  const form = new FormData();
  form.append("file", fileBuffer, {
    filename: fileName,
    contentType: "image/jpeg",
  });
  form.append(
    "parsing_instruction",
    "Extract the table exactly as-is. Return only the raw Markdown table with all rows and columns. Do not add any explanation."
  );

  let jobId;
  try {
    const uploadRes = await axios.post(`${LLAMA_BASE}/upload`, form, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
    });
    jobId = uploadRes.data.id;
    if (!jobId) throw new Error("LlamaParse: no job_id returned from upload");
    console.log(`[LlamaParse] Job submitted: ${jobId}`);
  } catch (err) {
    throw new Error(
      `LlamaParse upload failed: ${err.response?.data?.detail || err.message}`
    );
  }

  // Step 2: Poll for status first, then fetch markdown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      // Check job status
      const statusRes = await axios.get(
        `${LLAMA_BASE}/job/${jobId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      const status = statusRes.data.status;
      console.log(`[LlamaParse] Attempt ${attempt}/${MAX_ATTEMPTS} — status: ${status}`);

      if (status === "SUCCESS") {
        // Fetch the markdown result
        const resultRes = await axios.get(
          `${LLAMA_BASE}/job/${jobId}/result/markdown`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        const markdown = resultRes.data.markdown;
        if (!markdown) throw new Error("LlamaParse: job succeeded but markdown is empty");
        console.log("[LlamaParse] Markdown received successfully");
        return markdown;
      }

      if (status === "ERROR" || status === "FAILED") {
        throw new Error(`LlamaParse job failed with status: ${status}`);
      }

      // PENDING or PROCESSING — keep polling

    } catch (err) {
      if (err.message.startsWith("LlamaParse")) throw err;
      console.log(`[LlamaParse] Attempt ${attempt} error: ${err.message}`);
      continue;
    }
  }

  throw new Error(
    `LlamaParse timed out after ${MAX_ATTEMPTS} attempts. Try a smaller or clearer image.`
  );
}

module.exports = { parseImageToMarkdown };
