type RequestLike = {
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type SessionCookieOptions = {
  httpOnly: boolean;
  path: string;
  sameSite: "none" | "lax";
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

export function getSessionCookieOptions(req: RequestLike): SessionCookieOptions {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
  };
}