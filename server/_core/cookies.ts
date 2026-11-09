type RequestLike = {
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type SessionCookieOptions = {
  httpOnly: boolean;
  path: string;
  sameSite: "lax";
  secure: boolean;
};

function isSecureRequest(req: RequestLike): boolean {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers?.["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");
  return protoList.some((proto: string) => proto.trim().toLowerCase() === "https");
}

/**
 * Frontend and API share the same origin, so `lax` is enough and blocks the
 * cookie on cross-site POSTs (CSRF).
 */
export function getSessionCookieOptions(req: RequestLike): SessionCookieOptions {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
