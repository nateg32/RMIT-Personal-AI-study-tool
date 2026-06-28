const DEFAULT_CANVAS_ALLOWED_HOSTS = ["*.instructure.com"];

export type CanvasUrlOptions = {
  allowedHosts?: string[];
};

function cleanAllowedHost(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";

  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  }
}

export function canvasAllowedHostsFrom(value: string | null | undefined) {
  const hosts = (value || "")
    .split(",")
    .map(cleanAllowedHost)
    .filter(Boolean);

  return hosts.length ? hosts : DEFAULT_CANVAS_ALLOWED_HOSTS;
}

function isAllowedHost(hostname: string, allowedHosts: string[]) {
  const lowerHost = hostname.toLowerCase();

  return allowedHosts.some((allowedHost) => {
    const host = cleanAllowedHost(allowedHost);
    if (!host) return false;
    if (host.startsWith("*.")) {
      const suffix = host.slice(2);
      return lowerHost.endsWith(`.${suffix}`);
    }
    return lowerHost === host;
  });
}

export function normaliseCanvasBaseUrl(value: string, options: CanvasUrlOptions = {}) {
  const url = new URL(value.trim());
  const allowedHosts = options.allowedHosts || DEFAULT_CANVAS_ALLOWED_HOSTS;

  if (url.protocol !== "https:") {
    throw new Error("Canvas URL must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("Canvas URL must not include credentials.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Canvas URL must be an origin such as https://rmit.instructure.com.");
  }
  if (!isAllowedHost(url.hostname, allowedHosts)) {
    throw new Error("Canvas URL is not in the configured allowed host list.");
  }

  return url.origin;
}

export function resolveCanvasApiUrl(
  pathOrUrl: string,
  baseUrl: string,
  options: CanvasUrlOptions = {},
) {
  const baseOrigin = normaliseCanvasBaseUrl(baseUrl, options);
  const base = new URL(baseOrigin);
  const resolved = new URL(pathOrUrl, base);

  if (resolved.protocol !== "https:" || resolved.origin !== base.origin) {
    throw new Error("Canvas response attempted to use an off-origin URL.");
  }

  return resolved.toString();
}
