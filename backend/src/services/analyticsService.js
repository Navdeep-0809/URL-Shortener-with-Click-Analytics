import mongoose from "mongoose";
import Click from "../models/Click.js";
import Url from "../models/Url.js";
import { HttpError } from "../utils/httpError.js";

function fillMissingDays(clicksByDay, from, to) {
  const counts = new Map(clicksByDay.map(({ date, clicks }) => [date, clicks]));
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const days = [];

  for (let time = start; time <= end; time += 24 * 60 * 60 * 1000) {
    const date = new Date(time).toISOString().slice(0, 10);
    days.push({ date, clicks: counts.get(date) ?? 0 });
  }
  return days;
}

export async function getLinkAnalytics(
  { id, userId, from, to },
  { urlModel = Url, clickModel = Click } = {}
) {
  const link = await urlModel
    .findOne({ _id: id, userId })
    .select("code")
    .lean();
  if (!link) {
    throw new HttpError(404, "Short link not found.");
  }

  const [analytics] = await clickModel.aggregate([
    {
      $match: {
        urlId: new mongoose.Types.ObjectId(id),
        timestamp: { $gte: from, $lte: to }
      }
    },
    {
      $facet: {
        totals: [{ $count: "clicks" }],
        clicksByDay: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$timestamp",
                  timezone: "UTC"
                }
              },
              clicks: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, date: "$_id", clicks: 1 } }
        ],
        referrers: [
          {
            $group: {
              _id: { $ifNull: ["$referrer", "Direct / unknown"] },
              clicks: { $sum: 1 }
            }
          },
          { $sort: { clicks: -1, _id: 1 } },
          { $limit: 10 },
          { $project: { _id: 0, name: "$_id", clicks: 1 } }
        ],
        devices: [
          {
            $group: {
              _id: { $ifNull: ["$device", "Unknown"] },
              clicks: { $sum: 1 }
            }
          },
          { $sort: { clicks: -1, _id: 1 } },
          { $project: { _id: 0, name: "$_id", clicks: 1 } }
        ],
        browsers: [
          {
            $group: {
              _id: { $ifNull: ["$browser", "Unknown"] },
              clicks: { $sum: 1 }
            }
          },
          { $sort: { clicks: -1, _id: 1 } },
          { $project: { _id: 0, name: "$_id", clicks: 1 } }
        ],
        operatingSystems: [
          {
            $group: {
              _id: { $ifNull: ["$OS", "Unknown"] },
              clicks: { $sum: 1 }
            }
          },
          { $sort: { clicks: -1, _id: 1 } },
          { $project: { _id: 0, name: "$_id", clicks: 1 } }
        ],
        countries: [
          {
            $group: {
              _id: { $ifNull: ["$country", "Unknown"] },
              clicks: { $sum: 1 }
            }
          },
          { $sort: { clicks: -1, _id: 1 } },
          { $project: { _id: 0, country: "$_id", clicks: 1 } }
        ],
        cities: [
          {
            $group: {
              _id: {
                country: { $ifNull: ["$country", "Unknown"] },
                city: { $ifNull: ["$city", "Unknown"] }
              },
              clicks: { $sum: 1 }
            }
          },
          { $sort: { clicks: -1, "_id.country": 1, "_id.city": 1 } },
          { $limit: 10 },
          {
            $project: {
              _id: 0,
              country: "$_id.country",
              city: "$_id.city",
              clicks: 1
            }
          }
        ],
        recentClicks: [
          { $sort: { timestamp: -1 } },
          { $limit: 20 },
          {
            $project: {
              _id: 0,
              timestamp: 1,
              referrer: 1,
              device: 1,
              browser: 1,
              OS: 1,
              country: 1,
              city: 1
            }
          }
        ]
      }
    }
  ]);

  return {
    link: { id: link._id.toString(), code: link.code },
    range: { from: from.toISOString(), to: to.toISOString() },
    totalClicks: analytics?.totals?.[0]?.clicks ?? 0,
    clicksByDay: fillMissingDays(analytics?.clicksByDay ?? [], from, to),
    referrers: analytics?.referrers ?? [],
    devices: analytics?.devices ?? [],
    browsers: analytics?.browsers ?? [],
    operatingSystems: analytics?.operatingSystems ?? [],
    countries: analytics?.countries ?? [],
    cities: analytics?.cities ?? [],
    recentClicks: analytics?.recentClicks ?? []
  };
}
