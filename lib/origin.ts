type OriginEnvironment = {
  APP_ORIGIN?: string;
  APP_PREVIEW_ORIGIN?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  NODE_ENV?: string;
};

// Trust deployment configuration, never a caller-supplied Host/Forwarded header.
export function appOrigin(
  env: OriginEnvironment = process.env,
  developmentOrigin = "",
): string {
  if (env.VERCEL_ENV === "preview") {
    if (env.APP_PREVIEW_ORIGIN) {
      try {
        const configured = new URL(env.APP_PREVIEW_ORIGIN);
        if (
          configured.protocol !== "https:" ||
          !/^[a-z0-9-]+\.vercel\.app$/i.test(configured.hostname) ||
          configured.username ||
          configured.password ||
          configured.search ||
          configured.hash ||
          configured.pathname !== "/" ||
          configured.port
        )
          return "";
        return configured.origin;
      } catch {
        return "";
      }
    }
    const host = env.VERCEL_URL || "";
    if (host.length > 253 || !/^[a-z0-9-]+\.vercel\.app$/i.test(host))
      return "";
    return `https://${host.toLowerCase()}`;
  }
  const configured =
    env.APP_ORIGIN || (env.NODE_ENV === "development" ? developmentOrigin : "");
  try {
    const url = new URL(configured);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return "";
    return url.origin;
  } catch {
    return "";
  }
}
