import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  {
    collection: "users",
    versionKey: false
  }
);

userSchema.index({ email: 1 }, { unique: true, name: "user_email_unique" });

const User = mongoose.models.User ?? mongoose.model("User", userSchema);

export default User;
