import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { processLogFile } from "./parser.js";
import {
  detectAttacks,
  BRUTE_FORCE_THRESHOLD,
  BRUTE_FORCE_WINDOW_MS
} from "./detector.js";
import { createAggregator } from "./aggregator.js";
import { lookupCountry } from "./geoip.js";

const jobs = new Map();
const MAX_JOBS = 100;
const JOB_TTL_MS = 6 * 60 * 60 * 1000;

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    filename: job.filename,
    createdAt: job.createdAt,
    completedAt: job.completedAt ?? null,
    error: job.error ?? null,
    summary: job.result?.summary ?? null
  };
}

export function getJob(id) {
  const job = jobs.get(id);
  if (!job) return null;

  return {
    ...publicJob(job),
    result: job.result ?? null
  };
}

function cleanOldJobs() {
  const now = Date.now();

  for (const [id, job] of jobs) {
    if (
      job.status !== "processing" &&
      now - Date.parse(job.createdAt) > JOB_TTL_MS
    ) {
      jobs.delete(id);

      if (job.filePath) {
        fs.promises.unlink(job.filePath).catch(() => {});
      }
    }
  }
}

export function createJob(filePath, filename) {
  cleanOldJobs();

  if (jobs.size >= MAX_JOBS) {
    throw new Error("Too many jobs. Please try again later.");
  }

  const job = {
    id: crypto.randomUUID(),
    filePath,
    filename: path.basename(filename),
    status: "queued",
    progress: 0,
    createdAt: new Date().toISOString(),
    result: null,
    error: null
  };

  jobs.set(job.id, job);
  setImmediate(() => runJob(job));

  return publicJob(job);
}

async function runJob(job) {
  job.status = "processing";

  const aggregator = createAggregator();
  const failedLogins = new Map();
  let processed = 0;

  try {
    const stats = await processLogFile(
      job.filePath,
      async (record, lineNumber) => {
        processed++;

        const attacks = detectAttacks(record);

        if (record.statusCode === 401 && record.timestamp) {
          const timestamp = Date.parse(record.timestamp);

          if (Number.isFinite(timestamp)) {
            const recent = (failedLogins.get(record.ip) || [])
              .filter(
                (time) =>
                  time <= timestamp &&
                  timestamp - time <= BRUTE_FORCE_WINDOW_MS
              );

            recent.push(timestamp);
            failedLogins.set(record.ip, recent);

            if (recent.length >= BRUTE_FORCE_THRESHOLD) {
              attacks.push({
                type: "brute-force",
                name: "Possible Brute Force",
                severity: "high",
                reason:
                  `${recent.length} HTTP 401 responses from this IP ` +
                  "within five minutes"
              });
            }
          }
        }

        const country = await lookupCountry(record.ip);

        aggregator.add(record, attacks, lineNumber, country);

        if (processed % 1000 === 0) {
          job.progress = Math.min(95, job.progress + 1);
        }
      }
    );

    job.result = aggregator.finish(stats);
    job.status = "completed";
    job.progress = 100;
    job.completedAt = new Date().toISOString();
  } catch (error) {
    console.error(`LogLens job ${job.id} failed:`, error);

    job.status = "failed";
    job.error = error.message || "Processing failed";
    job.completedAt = new Date().toISOString();
  } finally {
    if (job.filePath) {
      await fs.promises.unlink(job.filePath).catch(() => {});
    }
  }
}