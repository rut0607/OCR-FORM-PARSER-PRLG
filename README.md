# 📒 Logbook Parser

> **Digitize handwritten manufacturing logbooks instantly** — upload a photo, get structured data back in seconds.

A production-grade full-stack application that transforms handwritten manufacturing logbook tables into clean, validated, downloadable data using OCR, LLM, and cloud storage — all without any manual data entry.

---

## 🏭 What This Project Does

Manufacturing facilities maintain physical logbooks to record production metrics — serial numbers, job codes, weights, scrap values, and dimensional measurements. Manually digitizing these into spreadsheets is slow, error-prone, and expensive.

**Logbook Parser automates this entirely:**

1. A worker photographs a logbook page with their phone
2. Uploads the JPEG to the web app
3. The system OCRs the handwritten table, interprets the data with an LLM, and returns a clean structured table
4. The operator downloads the result as JSON or CSV — ready to import into ERP, Excel, or any database

### What it extracts

| Column | Description | Example |
|---|---|---|
| NO | Row number | `1`, `2`, `35` |
| Job | Job/batch code | `2044` |
| Sn No | 7-digit serial number | `1276153` |
| Actual Weight | Pre-processing weight (kg) | `10.66` |
| After Core Weight | Post-processing weight (kg) | `10.45` |
| Core Scrap | Material lost (kg) | `0.11` |
| X and Y | Dimensional measurement (mm×mm) | `18.96x18.98` |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                           │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              React Frontend (Vite · port 5173)          │   │
│   │                                                         │   │
│   │   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│   │   │  UploadForm  │  │ ResultTable  │  │ StatusBadge │  │   │
│   │   │  .jsx        │  │ .jsx         │  │ .jsx        │  │   │
│   │   │              │  │              │  │             │  │   │
│   │   │ • File pick  │  │ • Table view │  │ • idle      │  │   │
│   │   │ • Preview    │  │ • JSON dl    │  │ • uploading │  │   │
│   │   │ • Submit     │  │ • CSV dl     │  │ • success   │  │   │
│   │   └──────────────┘  └──────────────┘  │ • error     │  │   │
│   │                                        └─────────────┘  │   │
│   └──────────────────────────┬──────────────────────────────┘   │
│                              │ POST /api/upload                  │
│                              │ multipart/form-data (JPEG)        │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Express Backend (Node.js · port 3001)          │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   routes/upload.js                      │   │
│   │                                                         │   │
│   │   multer (memoryStorage) → rateLimiter (10/15min)       │   │
│   │                                                         │   │
│   │   Step 1 ──► Step 2 ──► Step 3 ──► Sanitize ──► Save   │   │
│   └────┬─────────────┬──────────────┬────────────────┬──────┘   │
│        │             │              │                │           │
│        ▼             ▼              ▼                ▼           │
│   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│   │supabase │  │llamaparse│  │ gemini   │  │  LogEntry    │    │
│   │.js      │  │.js       │  │ .js      │  │  (Mongoose)  │    │
│   └─────────┘  └──────────┘  └──────────┘  └──────────────┘    │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌──────────────┐
│  Supabase  │ │ LlamaCloud │ │Google Gemini │ │ MongoDB      │
│  Storage   │ │ LlamaParse │ │  2.5 Flash   │ │ Atlas        │
│            │ │            │ │              │ │              │
│ Stores the │ │ OCR: image │ │ LLM: MD table│ │ Persists all │
│ original   │ │ → Markdown │ │ → JSON array │ │ parsed       │
│ JPEG image │ │ table      │ │ with         │ │ logbook      │
│ publicly   │ │            │ │ validation   │ │ entries      │
└────────────┘ └────────────┘ └──────────────┘ └──────────────┘
```

---

## 🔄 Data Flow (Step by Step)

```
📷 JPEG Photo
      │
      ▼
[1] multer memoryStorage
      │  Buffer in RAM — never touches disk
      ▼
[2] Supabase Storage Upload
      │  Returns: public image URL
      │  e.g. https://xxx.supabase.co/storage/v1/object/public/logbook-images/...
      ▼
[3] LlamaParse OCR
      │  POST /api/v1/parsing/upload  →  job_id
      │  Poll GET /api/v1/parsing/job/{id}  (every 4s, max 20 attempts)
      │  Returns: Markdown table string
      │
      │  Example output:
      │  | NO | Job  | Sn No   | Actual Weight | ... |
      │  |----|------|---------|---------------|-----|
      │  | 1  | 2044 | 1276153 | 10.66         | ... |
      ▼
[4] Google Gemini 2.5 Flash
      │  Prompt: strict JSON conversion with domain-aware validation rules
      │  - Core_Scrap always 0.10–1.50 (fixes OCR misreads like "3.63" → 0.63)
      │  - Sn_No always 7 digits
      │  - X_and_Y always "float x float" format
      │  - Commas → decimal points
      │  - Best-guess for overlapping handwritten digits
      │  Returns: JSON array
      ▼
[5] sanitizeEntries() — Post-processing safety net
      │  - Core_Scrap > 1.5 → fix leading digit to 0
      │  - Sn_No > 7 digits → trim
      │  - X_and_Y → normalize to lowercase x, fix commas
      │  - Weights → parse as float, fix commas
      ▼
[6] MongoDB (Mongoose)
      │  Save LogEntry document:
      │  { batchId, uploadedAt, imageUrl, originalFilename, entries[] }
      ▼
[7] JSON Response → React UI
      │  Display table, enable JSON/CSV download
      ▼
✅ Structured Data
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast dev server, modern JSX |
| Backend | Node.js + Express | Lightweight, async-friendly |
| OCR | LlamaParse (LlamaCloud) | Best-in-class handwriting OCR |
| LLM | Google Gemini 2.5 Flash | Fast, free tier, strong JSON output |
| Database | MongoDB Atlas + Mongoose | Flexible schema for variable logbook formats |
| File Storage | Supabase Storage | Free tier, instant public URLs |
| HTTP Client | axios | Promise-based, works in Node + browser |
| File Upload | multer (memoryStorage) | Buffer-only, no disk writes |
| Rate Limiting | express-rate-limit | 10 req/15min per IP |

---

## 📁 Folder Structure

```
parser/
├── client/                          # React Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── UploadForm.jsx       # File picker + submit button
│   │   │   ├── ResultTable.jsx      # Data table + JSON/CSV download
│   │   │   └── StatusBadge.jsx      # Pipeline status indicator
│   │   ├── App.jsx                  # Root component, state management
│   │   ├── main.jsx                 # React entry point
│   │   └── index.css                # Global styles (IBM Plex, dark theme)
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                          # Node.js Express backend
│   ├── routes/
│   │   └── upload.js                # POST /api/upload — full pipeline + sanitizer
│   ├── services/
│   │   ├── llamaparse.js            # LlamaCloud REST API + polling loop
│   │   ├── gemini.js                # Gemini prompt + JSON extraction
│   │   └── supabase.js              # Supabase Storage upload
│   ├── models/
│   │   └── LogEntry.js              # Mongoose schema
│   ├── middleware/
│   │   └── rateLimiter.js           # express-rate-limit config
│   ├── index.js                     # Express app + MongoDB connection
│   ├── test-gemini.js               # Isolated Gemini test (no LlamaParse)
│   └── package.json
│
├── .gitignore
├── .env.example                     # Template — copy to server/.env
└── README.md
```

---

## ⚙️ Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | Check with `node --version` |
| MongoDB Atlas account | Free M0 cluster at [mongodb.com](https://www.mongodb.com/cloud/atlas) |
| LlamaCloud account | Free 10,000 credits/month at [cloud.llamaindex.ai](https://cloud.llamaindex.ai) |
| Google AI Studio account | Free Gemini API key at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Supabase project | Free tier at [supabase.com](https://supabase.com) |

---

## 🚀 Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/rut0607/OCR-FORM-PARSER-PRLG.git
cd OCR-FORM-PARSER-PRLG/parser
```

### 2. Install dependencies

```bash
# Server
cd server && npm install

# Client (open a new terminal)
cd client && npm install
```

### 3. Configure environment variables

```bash
cp .env.example server/.env
nano server/.env
```

Fill in all values:

```env
PORT=3001
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/logbook?appName=Cluster0
LLAMA_CLOUD_API_KEY=llx-...
GEMINI_API_KEY=AIzaSy...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_BUCKET=logbook-images
```

> ⚠️ If your password contains special characters (e.g. `@`), URL-encode them: `@` → `%40`

### 4. Supabase bucket setup

1. Supabase Dashboard → **Storage** → **New bucket**
2. Name: `logbook-images`
3. Toggle **Public** → ON
4. Click **Create bucket**

### 5. MongoDB Atlas network access

1. Atlas Dashboard → **Network Access** → **Add IP Address**
2. Click **Allow Access from Anywhere** (`0.0.0.0/0`)
3. Confirm

### 6. Test Gemini in isolation (recommended first step)

```bash
cd server
node test-gemini.js
```

Expected output:
```
✅ Gemini returned valid JSON array:
[ { "NO": 1, "Job": "J-1042", ... } ]
✅ All rows contain the required keys.
```

### 7. Start the server

```bash
cd server
node index.js
```

Expected:
```
✅ MongoDB connected
🚀 Server running on http://localhost:3001
```

### 8. Start the frontend

```bash
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 📡 API Reference

### `POST /api/upload`

Accepts a JPEG photo of a logbook page and runs the full OCR → LLM → DB pipeline.

**Request**

```
Content-Type: multipart/form-data
Field: image (File, JPEG, max 10MB)
```

**Success Response `200`**

```json
{
  "success": true,
  "batchId": "batch_1746789012345",
  "imageUrl": "https://xxx.supabase.co/storage/v1/object/public/logbook-images/...",
  "entries": [
    {
      "NO": 1,
      "Job": "2044",
      "Sn_No": "1276153",
      "Actual_Weight": 10.66,
      "After_Core_Weight": 10.45,
      "Core_Scrap": 0.11,
      "X_and_Y": "18.96x18.98"
    }
  ]
}
```

**Error Response `500`**

```json
{
  "success": false,
  "error": "LlamaParse timed out after 20 attempts.",
  "raw": "| NO | Job | ..."
}
```

> The `raw` field returns the OCR markdown when Gemini fails — useful for debugging prompt issues.

**Rate limit `429`**

```json
{ "error": "Too many uploads. Please wait before trying again." }
```

Max 10 uploads per 15 minutes per IP.

---

## 🔑 Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `PORT` | Server port (default 3001) | Set manually |
| `MONGODB_URI` | MongoDB Atlas connection string | Atlas → Connect → Drivers |
| `LLAMA_CLOUD_API_KEY` | LlamaCloud API key | cloud.llamaindex.ai → API Keys |
| `GEMINI_API_KEY` | Google Gemini API key | aistudio.google.com/app/apikey |
| `SUPABASE_URL` | Supabase project URL | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase → Settings → API |
| `SUPABASE_BUCKET` | Storage bucket name | Set to `logbook-images` |

---

## 📊 Free Tier Limits

| Service | Free Limit | Notes |
|---|---|---|
| LlamaParse | 10,000 pages/month | 1 upload = 1 credit |
| Gemini 2.5 Flash | 500 req/day, 15 req/min | Resets daily |
| Supabase Storage | 1 GB | ~10,000 JPEG uploads |
| MongoDB Atlas M0 | 512 MB | Thousands of logbook records |

---

## 🐛 Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `LlamaParse upload failed: Not authenticated` | Missing/wrong `LLAMA_CLOUD_API_KEY` | Get key from cloud.llamaindex.ai |
| `LlamaParse timed out` | Image too large or complex | Use clearer photo, max 5MB |
| `Gemini returned invalid JSON` | Gemini wrapped output in fences | Check `raw` field in error response |
| `MongoDB connection failed: Invalid scheme` | URI has duplicate `MONGODB_URI=` prefix | Run `node -e "require('dotenv').config(); console.log(process.env.MONGODB_URI)"` to inspect |
| `EADDRINUSE :::3001` | Port already in use | Run `lsof -ti:3001 \| xargs kill -9` |
| `Core_Scrap showing 3.63 instead of 0.63` | OCR misread `0` as `3` | sanitizeEntries() auto-fixes this |
| `Supabase WebSocket error on Node 20` | Missing `ws` package | Run `npm install ws` in server/ |

---

## 🔮 Potential Improvements

- **Batch upload** — process multiple logbook pages in one request
- **Edit mode** — let operators correct misread values directly in the UI before saving
- **Export to Excel** — `.xlsx` download with formatted columns
- **History view** — browse all previously parsed batches from MongoDB
- **Confidence scores** — flag low-confidence OCR reads for manual review
- **Mobile PWA** — photograph and upload directly from phone camera
- **Webhook support** — push parsed data automatically to ERP systems

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Built with LlamaParse · Gemini · MongoDB · Supabase · React · Express*