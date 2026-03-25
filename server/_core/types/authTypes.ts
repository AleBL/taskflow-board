export interface AuthorizeRequest {
  redirectUri: string;
  projectId: string;
  state: string;
  responseType: string;
  scope: string;
}

export interface AuthorizeResponse {
  redirectUrl: string;
}

export interface GetUserInfoRequest {
  accessToken: string;
}

export interface CanAccessRequest {
  openId: string;
  projectId: string;
}

export interface CanAccessResponse {
  canAccess: boolean;
}

export interface GetUserInfoWithJwtRequest {
  jwtToken: string;
  projectId: string;
}

export interface GetUserInfoWithJwtResponse {
  openId: string;
  projectId: string;
  name: string;
  email?: string | null;
  platform?: string | null;
  loginMethod?: string | null;
}
