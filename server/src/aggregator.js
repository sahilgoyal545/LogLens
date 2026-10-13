
export function createAggregator() {
  const hourly = new Map();
  const attackers = new Map();
  const severityCounts = { high: 0, medium: 0, low: 0 };
  const attackTypeCounts = {};
  const findings = [];
  const findingsLimit = 5000;

  let totalRequests = 0;
  let totalBytes = 0;
  let detectedRequests = 0;
  let totalAttackMatches = 0;

  return {
    add(record, attacks, lineNumber, country = null) {
      totalRequests++;
      totalBytes += record.bytes || 0;

      let attacker = attackers.get(record.ip);

      if (!attacker) {
        attacker = {
          ip: record.ip,
          requests: 0,
          attacks: 0,
          types: new Set(),
          country
        };
        attackers.set(record.ip, attacker);
      }

      attacker.requests++;

      if (country) attacker.country = country;

      if (attacks.length) detectedRequests++;

      for (const attack of attacks) {
        totalAttackMatches++;

        severityCounts[attack.severity] =
          (severityCounts[attack.severity] || 0) + 1;

        attackTypeCounts[attack.type] =
          (attackTypeCounts[attack.type] || 0) + 1;

        attacker.attacks++;
        attacker.types.add(attack.type);

        if (record.timestamp) {
          const hour = `${record.timestamp.slice(0, 13)}:00:00Z`;
          hourly.set(hour, (hourly.get(hour) || 0) + 1);
        }

        if (findings.length < findingsLimit) {
          findings.push({
            lineNumber,
            ip: record.ip,
            timestamp: record.timestamp,
            method: record.method,
            path: record.originalPath,
            statusCode: record.statusCode,
            userAgent: record.userAgent,
            type: attack.type,
            attackName: attack.name,
            severity: attack.severity,
            reason: attack.reason,
            country
          });
        }
      }
    },

    finish(lineStats) {
      return {
        summary: {
          ...lineStats,
          totalRequests,
          totalBytes,
          detectedRequests,
          totalAttackMatches,
          severityCounts,
          attackTypeCounts,
          findingsStored: findings.length,
          findingsLimit,
          findingsTruncated: totalAttackMatches > findingsLimit
        },

        attacksPerHour: [...hourly.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([hour, count]) => ({ hour, count })),

        topAttackers: [...attackers.values()]
          .filter((item) => item.attacks > 0)
          .map((item) => ({
            ...item,
            types: [...item.types]
          }))
          .sort((a, b) => b.attacks - a.attacks)
          .slice(0, 20),

        findings
      };
    }
  };
}
