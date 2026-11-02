import mongoose from "mongoose";

const clickSchema = new mongoose.Schema(
  {
    urlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Url",
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    referrer: {
      type: String,
      maxlength: 255,
      default: null
    },
    userAgent: {
      type: String,
      maxlength: 512,
      default: null
    },
    device: {
      type: String,
      maxlength: 64,
      default: "Unknown"
    },
    browser: {
      type: String,
      maxlength: 100,
      default: "Unknown"
    },
    OS: {
      type: String,
      maxlength: 100,
      default: "Unknown"
    },
    country: {
      type: String,
      maxlength: 2,
      default: null
    },
    city: {
      type: String,
      maxlength: 100,
      default: null
    },
    ipHash: {
      type: String,
      maxlength: 64,
      select: false,
      default: null
    }
  },
  {
    collection: "clicks",
    versionKey: false
  }
);

clickSchema.index({ urlId: 1, timestamp: -1 }, { name: "click_url_timestamp" });

const Click = mongoose.models.Click ?? mongoose.model("Click", clickSchema);

export default Click;
