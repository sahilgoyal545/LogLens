const signatures = [
  {
    id: "sql-injection",
    name: "SQL Injection",
    severity: "high",
    patterns: [
      /(?:'|%27|%2527)\s*(?:or|and)\s+\d+\s*=\s*\d+/i,
      /\bunion(?:\s|\+|%20)+(?:all(?:\s|\+|%20)+)?select\b/i,
      /\bsleep\s*\(/i
    ]
  },
  {
    id: "xss",
    name: "Cross-Site Scripting (XSS)",
    severity: "high",
    patterns: [
      /<\s*script\b/i,
      /javascript\s*:/i,
      /\bonerror\s*=/i,
      /\bonload\s*=/i
    ]
  },
  {
    id: "directory-traversal",
    name: "Directory Traversal",
    severity: "high",
    patterns: [
      /\.\.[/\\]/i,
      /%2e%2e(?:%2f|%5c)/i,
      /(?:\/|%2f)etc(?:\/|%2f)passwd/i
    ]
  }
];

export const BRUTE_FORCE_THRESHOLD = 5;
export const BRUTE_FORCE_WINDOW_MS = 5 * 60 * 1000;

export function detectAttacks(record) {
  const target = [
    record.originalPath,
    record.path,
    record.referer
  ].filter(Boolean).join(" ");

  const attacks = [];

  for (const signature of signatures) {
    if (signature.patterns.some(pattern => pattern.test(target))) {
      attacks.push({
        type: signature.id,
        name: signature.name,
        severity: signature.severity,
        reason: `Matched ${signature.name} signature`
      });
    }
  }

  return attacks;
}