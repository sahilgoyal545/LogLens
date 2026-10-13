import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJob, getJob } from "./jobs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(serverRoot, "..");

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const uploadDirectory = path.join(serverRoot, "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
}));
app.use(express.json({ limit: "100kb" }));

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (_req, file, callback) => {
    const safeName = path.basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-150);

    callback(null, `${Date.now()}-${safeName || "access.log"}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (![".log", ".txt"].includes(extension)) {
      return callback(new Error("Upload a .log or .txt file."));
    }

    callback(null, true);
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "LogLens API"
  });
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Select a log file to upload."
    });
  }

  try {
    const job = createJob(req.file.path, req.file.originalname);

    return res.status(202).json({
      message: "Log file accepted for analysis.",
      job
    });
  } catch (error) {
    fs.promises.unlink(req.file.path).catch(() => {});

    return res.status(429).json({
      error: error.message || "Unable to create analysis job."
    });
  }
});

app.post("/api/demo", (_req, res) => {
  const demoPath = path.join(projectRoot, "sample-logs", "demo.log");

  if (!fs.existsSync(demoPath)) {
    return res.status(404).json({
      error: "Demo log not found. Add sample-logs/demo.log."
    });
  }

  try {
    const demoCopy = path.join(
  uploadDirectory,
  `demo-${Date.now()}.log`
);

fs.copyFileSync(demoPath, demoCopy);

const job = createJob(demoCopy, "demo.log");

    return res.status(202).json({
      message: "Demo analysis started.",
      job
    });
  } catch (error) {
    return res.status(429).json({
      error: error.message || "Unable to create demo job."
    });
  }
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);

  if (!job) {
    return res.status(404).json({
      error: "Analysis job not found or expired."
    });
  }

  res.json({ job });
});

app.get("/api/jobs/:id/report", (req, res) => {
  const job = getJob(req.params.id);

  if (!job) {
    return res.status(404).json({
      error: "Analysis job not found or expired."
    });
  }

  if (job.status !== "completed" || !job.result) {
    return res.status(409).json({
      error: "The report is not ready yet.",
      status: job.status
    });
  }

  const format = String(req.query.format || "json").toLowerCase();

  if (format === "json") {
    return res.json({
      jobId: job.id,
      filename: job.filename,
      completedAt: job.completedAt,
      ...job.result
    });
  }

  if (format === "csv") {
    const columns = [
      "lineNumber",
      "timestamp",
      "ip",
      "country",
      "method",
      "path",
      "statusCode",
      "attackName",
      "type",
      "severity",
      "reason",
      "userAgent"
    ];

    const escapeCsv = (value) => {
      let text = String(value ?? "");

      if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
      }

      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = [
      columns.join(","),
      ...job.result.findings.map((finding) =>
        columns.map((column) => escapeCsv(finding[column])).join(",")
      )
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="loglens-${job.id}.csv"`
    );

    return res.send(rows.join("\r\n"));
  }

  return res.status(400).json({
    error: "Unsupported report format. Use json or csv."
  });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

    return res.status(status).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "File exceeds the 100 MB upload limit."
        : error.message
    });
  }

  if (error.message === "Upload a .log or .txt file.") {
    return res.status(400).json({ error: error.message });
  }

  console.error(error);

  return res.status(500).json({
    error: "An unexpected server error occurred."
  });
});

app.listen(PORT, () => {
  console.log(`LogLens API running at http://localhost:${PORT}`);
});