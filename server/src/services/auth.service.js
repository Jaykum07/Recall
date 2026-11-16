import bcrypt from "bcrypt";
import User from "../models/user.model.js";

// Use a real bcrypt comparison even for unknown users to reduce timing differences.
const dummyPasswordHash = bcrypt.hash("login-timing-placeholder", 12);

export const loginUserService = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+passwordHash");
  const matches = await bcrypt.compare(password, user?.passwordHash ?? await dummyPasswordHash);

  if (!user || !matches) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  return { id: user._id.toString(), name: user.name, email: user.email };
};

export const registerUserService = async ({ name, email, password }) => {
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    // Wait for the unique email index before accepting account creation.
    await User.init();
    const user = await User.create({ name, email, passwordHash });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    };
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.email) {
      const error = new Error("Email is already registered");
      error.statusCode = 409;
      throw error;
    }
    // Database errors can contain document values; never send them to clients.
    throw new Error("Unable to register user");
  }
};
