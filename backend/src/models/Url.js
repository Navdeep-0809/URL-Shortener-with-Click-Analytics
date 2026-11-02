import mongoose from "mongoose";

const urlSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 30,
      match: /^[A-Za-z0-9_-]+$/
    },
    longUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
      validate: {
        validator(value) {
          try {
            const parsed = new URL(value);
            return (
              ["http:", "https:"].includes(parsed.protocol) &&
              !parsed.username &&
              !parsed.password
            );
          } catch {
            return false;
          }
        },
        message: "Destination must be a valid HTTP or HTTPS URL without embedded credentials."
      }
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    customAlias: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    },
    passwordHash: {
      type: String,
      select: false,
      default: null
    },
    clickLimit: {
      type: Number,
      min: 1,
      default: null
    },
    clicks: {
      type: Number,
      min: 0,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  {
    collection: "urls",
    versionKey: false
  }
);

urlSchema.index({ code: 1 }, { unique: true, name: "url_code_unique" });
urlSchema.index({ userId: 1, createdAt: -1 }, { name: "url_owner_created_at" });

const Url = mongoose.models.Url ?? mongoose.model("Url", urlSchema);

export default Url;
