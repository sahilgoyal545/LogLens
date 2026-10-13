
import maxmind from "maxmind";
import fs from "node:fs";

let readerPromise;

async function getReader() {
  if (!readerPromise) {
    readerPromise = (async () => {
      const databasePath = process.env.GEOIP_DB_PATH;

      if (!databasePath || !fs.existsSync(databasePath)) {
        return null;
      }

      try {
        return await maxmind.open(databasePath);
      } catch (error) {
        console.warn("GeoIP database unavailable:", error.message);
        return null;
      }
    })();
  }

  return readerPromise;
}

function isPublicIPv4(ip) {
  const parts = ip.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b, c] = parts;

  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export async function lookupCountry(ip) {
  if (!isPublicIPv4(ip)) return null;

  const reader = await getReader();
  if (!reader) return null;

  const result = reader.get(ip);

  return (
    result?.country?.names?.en ??
    result?.registered_country?.names?.en ??
    null
  );
}
