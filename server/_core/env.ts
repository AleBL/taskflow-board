export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN ?? "",
  ownerOpenId: "",
  isProduction: process.env.NODE_ENV === "production",
};
