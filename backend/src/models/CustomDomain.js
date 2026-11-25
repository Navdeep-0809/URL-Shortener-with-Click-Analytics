import mongoose from "mongoose";

const customDomainSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    hostname: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 253
    },
    verificationToken: {
      type: String,
      required: true,
      select: false
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  {
    collection: "custom_domains",
    versionKey: false
  }
);

customDomainSchema.index(
  { hostname: 1 },
  { unique: true, name: "custom_domain_hostname_unique" }
);
customDomainSchema.index(
  { userId: 1, createdAt: -1 },
  { name: "custom_domain_owner_created_at" }
);

const CustomDomain = mongoose.models.CustomDomain ??
  mongoose.model("CustomDomain", customDomainSchema);

export default CustomDomain;
