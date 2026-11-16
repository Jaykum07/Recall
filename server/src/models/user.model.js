import mongoose from "mongoose";

const removePasswordHash = (doc, result) => {
  delete result.passwordHash;
  return result;
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
    },
    passwordHash: { type: String, required: true, select: false },
  },
  {
    timestamps: true,
    toJSON: { transform: removePasswordHash },
    toObject: { transform: removePasswordHash },
  },
);

const User = mongoose.model("User", userSchema);

export default User;
