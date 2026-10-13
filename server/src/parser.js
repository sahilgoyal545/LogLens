
import fs from "node:fs";
import readline from "node:readline";

const LOG_PATTERN =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+)\s+(.+?)\s+HTTP\/[\d.]+" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?/;

function parseTimestamp(value) {
  const match = value.match(
    /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}:\d{2}:\d{2}) ([+-]\d{4})$/
  );

  if (!match) return null;

  const [, day, month, year, time, offset] = match;
  const months = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12"
  };

  const date = new Date(
    `${year}-${months[month]}-${day}T${time}${offset.slice(0, 3)}:${offset.slice(3)}`
  );

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseLogLine(line) {
  const match = line.match(LOG_PATTERN);
  if (!match) return null;

  const originalPath = match[4];
  let decodedPath = originalPath;

  try {
    decodedPath = decodeURIComponent(originalPath);
  } catch {
    // Keep the original path if percent encoding is malformed.
  }

  return {
    ip: match[1],
    timestamp: parseTimestamp(match[2]),
    method: match[3],
    path: decodedPath,
    originalPath,
    statusCode: Number(match[5]),
    bytes: match[6] === "-" ? 0 : Number(match[6]) || 0,
    referer: match[7] || "",
    userAgent: match[8] || ""
  };
}

export async function processLogFile(filePath, onRecord) {
  const input = fs.createReadStream(filePath, {
    encoding: "utf8"
  });

  const lines = readline.createInterface({
    input,
    crlfDelay: Infinity
  });

  let totalLines = 0;
  let parsedLines = 0;
  let invalidLines = 0;

  try {
    for await (const line of lines) {
      totalLines++;

      if (!line.trim()) continue;

      const record = parseLogLine(line);

      if (!record) {
        invalidLines++;
        continue;
      }

      parsedLines++;
      await onRecord(record, totalLines);
    }
  } finally {
    lines.close();
    input.destroy();
  }

  return { totalLines, parsedLines, invalidLines };
}
