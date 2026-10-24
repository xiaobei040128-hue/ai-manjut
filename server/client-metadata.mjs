import { isIP } from "node:net";
export function clientMetadata(
  req,
  trustProxy = process.env.DRAMA_TRUST_PROXY === "1",
) {
  const normalize = (value) => String(value || "").replace(/^::ffff:/, "");
  let ip = normalize(req.socket?.remoteAddress);
  // Forwarded headers are ignored unless this deployment explicitly trusts its proxy.
  const trustedPeers = (
    process.env.DRAMA_TRUST_PROXY_ADDRESSES || "127.0.0.1,::1"
  )
    .split(",")
    .map((v) => v.trim());
  if (trustProxy && trustedPeers.includes(ip)) {
    const candidate = normalize(
      String(req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim(),
    );
    if (isIP(candidate)) ip = candidate;
  }
  return {
    ip: isIP(ip) ? ip : "",
    agent: String(req.headers["user-agent"] || "")
      .replace(/[\x00-\x1f\x7f]/g, "")
      .slice(0, 300),
  };
}
