import jwt from "jsonwebtoken";
import { getJwtConfig } from "../config/jwt.js";

export const generateAccessToken = (userId) => {
  const { secret, issuer, audience } = getJwtConfig();
  return jwt.sign({}, secret, {
    algorithm: "HS256",
    subject: userId,
    issuer,
    audience,
    expiresIn: 15 * 60,
  });
};
