const express = require("express");
const multer = require("multer");
const router = express.Router();

const rateLimiter = require("../middleware/rateLimiter");
const { uploadToSupabase } = require("../services/supabase");
const { parseImageToMarkdown } = require("../services/llamaparse");
const { convertToJSON } = require("../services/gemini");
const LogEntry = require("../models/LogEntry");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Post-processing sanitizer ─────────────────────────────────
function sanitizeEntries(entries) {
  return entries.map((entry) => {
    let sanitized = { ...entry };

    // Core_Scrap is always between 0.10 and 1.50
    // If OCR reads "3.63" or "8.76", fix the leading digit to 0
    if (sanitized.Core_Scrap !== null && sanitized.Core_Scrap !== undefined) {
      const val = parseFloat(sanitized.Core_Scrap);
      if (!isNaN(val) && val > 1.5) {
        const str = String(val).replace(".", "");
        sanitized.Core_Scrap = parseFloat("0." + str.slice(1));
      }
    }

    // Sn_No should be 7 digits max
    if (sanitized.Sn_No !== null && sanitized.Sn_No !== undefined) {
      const str = String(sanitized.Sn_No).replace(/\D/g, "");
      if (str.length > 7) {
        // Try to find the most plausible 7-digit number from the end
        sanitized.Sn_No = str.slice(-7);
      } else {
        sanitized.Sn_No = str;
      }
    }

    // X_and_Y — normalize separator to lowercase x, fix commas
    if (sanitized.X_and_Y !== null && sanitized.X_and_Y !== undefined) {
      let xy = String(sanitized.X_and_Y);
      xy = xy.replace(/,/g, "."); // fix commas → dots
      xy = xy.replace(/X/g, "x"); // normalize to lowercase x
      xy = xy.replace(/\s/g, ""); // remove spaces
      sanitized.X_and_Y = xy;
    }

    // Actual_Weight and After_Core_Weight — fix commas, ensure float
    ["Actual_Weight", "After_Core_Weight"].forEach((key) => {
      if (sanitized[key] !== null && sanitized[key] !== undefined) {
        const str = String(sanitized[key]).replace(",", ".");
        const val = parseFloat(str);
        sanitized[key] = isNaN(val) ? null : val;
      }
    });

    return sanitized;
  });
}

// ── POST / ────────────────────────────────────────────────────
router.post(
  "/",
  rateLimiter,
  upload.single("image"),
  async (req, res) => {
    let markdownResult = null;

    try {
      // 1. Validate file
      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded." });
      }
      if (req.file.mimetype !== "image/jpeg") {
        return res.status(400).json({
          success: false,
          error: `Invalid file type: "${req.file.mimetype}". Only image/jpeg is accepted.`,
        });
      }

      const batchId = `batch_${Date.now()}`;
      const originalFilename = req.file.originalname;

      console.log(`\n[Upload] ── Starting pipeline: ${batchId} ──`);

      // 2. Upload to Supabase
      console.log("[Upload] 1/3 Uploading to Supabase…");
      const { publicUrl } = await uploadToSupabase(req.file.buffer, originalFilename);
      console.log(`[Upload] ✅ Supabase URL: ${publicUrl}`);

      // 3. OCR via LlamaParse
      console.log("[Upload] 2/3 Parsing image with LlamaParse…");
      markdownResult = await parseImageToMarkdown(req.file.buffer, originalFilename);
      console.log("[Upload] ✅ Markdown extracted:");
      console.log(markdownResult.slice(0, 500));

      // 4. Convert to JSON via Gemini
      console.log("[Upload] 3/3 Converting to JSON with Gemini…");
      const rawArray = await convertToJSON(markdownResult);
      console.log(`[Upload] ✅ Gemini returned ${rawArray.length} entries`);

      // 5. Sanitize entries
      const jsonArray = sanitizeEntries(rawArray);
      console.log("[Upload] ✅ Entries sanitized");

      // 6. Save to MongoDB
      const logEntry = new LogEntry({
        batchId,
        imageUrl: publicUrl,
        originalFilename,
        entries: jsonArray,
      });
      await logEntry.save();
      console.log(`[Upload] ✅ Saved to MongoDB: ${logEntry._id}`);
      console.log(`[Upload] ── Pipeline complete ──\n`);

      return res.status(200).json({
        success: true,
        batchId,
        imageUrl: publicUrl,
        entries: jsonArray,
      });

    } catch (err) {
      console.error("[Upload] ❌ Pipeline error:", err.message);
      return res.status(500).json({
        success: false,
        error: err.message,
        raw: markdownResult || null,
      });
    }
  }
);

module.exports = router;
