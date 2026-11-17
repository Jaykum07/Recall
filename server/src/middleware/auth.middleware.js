import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { getJwtConfig } from "../config/jwt.js";
import User from "../models/user.model.js";

const unauthorized = (res) => res.status(401).json({
  success: false,
  message: "Authentication required",
  errors: null,
});

export const authenticate = async (req, res, next) => {
  const authorization = req.get("authorization");
  // Scheme names are case-insensitive; accept exactly one compact JWT credential.
  const match = typeof authorization === "string"
    && /^Bearer +([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization);
  if (!match) return unauthorized(res);

  let config;
  try {
    config = getJwtConfig();
  } catch {
    return next(new Error("Unable to authenticate user"));
  }

  let claims;
  try {
    claims = jwt.verify(match[1], config.secret, {
      algorithms: ["HS256"],
      issuer: config.issuer,
      audience: config.audience,
    });
    // verify checks exp when present; this API also requires it to be present.
    if (!Number.isFinite(claims.exp)
      || typeof claims.sub !== "string"
      || !mongoose.isObjectIdOrHexString(claims.sub)) {
      return unauthorized(res);
    }
  } catch {
    return unauthorized(res);
  }

  let user;
  try {
    user = await User.findById(claims.sub).select("_id name email").lean();
  } catch {
    // Database failures must not expose driver messages or query contents.
    return next(new Error("Unable to authenticate user"));
  }
  if (!user) return unauthorized(res);

  req.user = { id: user._id.toString(), name: user.name, email: user.email };
  return next();
};
