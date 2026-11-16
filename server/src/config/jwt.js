export const getJwtConfig = () => {
  const { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = process.env;
  // Decode only validated hex: Buffer.from otherwise silently truncates bad input.
  const validSecret = typeof JWT_SECRET === "string"
    && JWT_SECRET.length >= 64 && JWT_SECRET.length % 2 === 0
    && !/[^a-fA-F0-9]/.test(JWT_SECRET)
    && !/^(..)(?:\1)+$/i.test(JWT_SECRET);
  const validIdentifier = (value) => typeof value === "string"
    && value.length > 0 && value.length <= 256
    && !/\s/.test(value);

  if (!validSecret || !validIdentifier(JWT_ISSUER) || !validIdentifier(JWT_AUDIENCE)) {
    // Never embed configuration values in errors.
    throw new Error("Invalid JWT configuration");
  }

  return {
    secret: Buffer.from(JWT_SECRET, "hex"),
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };
};
