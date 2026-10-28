import { BlockList, isIP } from "node:net";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
let lookup = null,
  initial = null;
const privateNetworks = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
])
  privateNetworks.addSubnet(ip, prefix, "ipv4");
for (const [ip, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
])
  privateNetworks.addSubnet(ip, prefix, "ipv6");
export function initializeGeoCountry() {
  if (initial) return initial;
  initial = (async () => {
    const old = process.env.ILA_SKIP_INITIAL_RELOAD;
    process.env.ILA_SKIP_INITIAL_RELOAD = "true";
    let geo;
    try {
      geo = await import("ip-location-api");
    } finally {
      if (old === undefined) delete process.env.ILA_SKIP_INITIAL_RELOAD;
      else process.env.ILA_SKIP_INITIAL_RELOAD = old;
    }
    const root = fileURLToPath(new URL("../runtime-geoip/", import.meta.url));
    await geo.reload({
      fields: ["country"],
      ipLocationDb: "user",
      autoUpdate: false,
      addCountryInfo: false,
      skipInitialReload: false,
      silent: true,
      dataDir: join(root, "data"),
      tmpDataDir: join(root, "tmp"),
    });
    lookup = geo.lookup;
  })().catch((e) => {
    lookup = null;
    console.warn(
      "Country database unavailable; IP countries will remain unknown:",
      e.message,
    );
  });
  return initial;
}
export function locateCountry(ip) {
  const family = isIP(ip);
  if (!family) return { country: "", source: "unknown" };
  if (privateNetworks.check(ip, family === 4 ? "ipv4" : "ipv6"))
    return { country: "", source: "private" };
  if (!lookup) return { country: "", source: "unavailable" };
  try {
    const result = lookup(ip);
    return result?.country
      ? { country: result.country, source: "ip" }
      : { country: "", source: "unknown" };
  } catch {
    return { country: "", source: "unknown" };
  }
}
