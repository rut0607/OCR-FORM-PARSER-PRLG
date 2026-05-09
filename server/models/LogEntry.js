const mongoose = require("mongoose");

const entrySchema = new mongoose.Schema(
  {
    NO: { type: mongoose.Schema.Types.Mixed, default: null },
    Job: { type: String, default: null },
    Sn_No: { type: String, default: null },
    Actual_Weight: { type: mongoose.Schema.Types.Mixed, default: null },
    After_Core_Weight: { type: mongoose.Schema.Types.Mixed, default: null },
    Core_Scrap: { type: mongoose.Schema.Types.Mixed, default: null },
    X_and_Y: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const logEntrySchema = new mongoose.Schema({
  batchId: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  imageUrl: { type: String, required: true },
  originalFilename: { type: String },
  entries: [entrySchema],
});

module.exports = mongoose.model("LogEntry", logEntrySchema);
