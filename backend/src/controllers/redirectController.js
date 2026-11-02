import { verifyLinkPassword } from "../services/linkOptions.js";
import { scheduleClickLogging } from "../services/clickLoggingService.js";
import Click from "../models/Click.js";
import Url from "../models/Url.js";

function isExpired(url, now) {
  return url.expiresAt instanceof Date && url.expiresAt <= now;
}

function respondUnavailable(response, url, now) {
  if (!url) {
    return response.status(404).json({ error: "Short link not found." });
  }
  if (!url.isActive) {
    return response.status(410).json({ error: "This short link is disabled." });
  }
  if (isExpired(url, now)) {
    return response.status(410).json({ error: "This short link has expired." });
  }
  if (url.clickLimit !== null && url.clickLimit !== undefined && url.clicks >= url.clickLimit) {
    return response.status(410).json({ error: "This short link has reached its click limit." });
  }
  return response.status(410).json({ error: "This short link is no longer available." });
}

function renderPasswordForm(response, code, statusCode = 200, message = "") {
  response
    .status(statusCode)
    .set("Cache-Control", "no-store")
    .type("html")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Password-protected link</title>
  </head>
  <body>
    <main>
      <h1>Password-protected link</h1>
      <p>Enter the password provided by the link owner to continue.</p>
      ${message ? `<p role="alert">${message}</p>` : ""}
      <form method="post" action="/api/urls/${code}/verify">
        <label for="password">Link password</label>
        <input id="password" name="password" type="password" required autocomplete="current-password">
        <button type="submit">Continue</button>
      </form>
    </main>
  </body>
</html>`);
}

function scheduleClick(request, url, dependencies, countAlreadyIncremented) {
  const { urlModel, clickModel, schedule } = dependencies;
  scheduleClickLogging(
    {
      urlId: url._id,
      referrer: request.get?.("referer"),
      userAgent: request.get?.("user-agent"),
      ip: request.ip
    },
    {
      urlModel,
      clickModel,
      schedule,
      incrementCounter: !countAlreadyIncremented
    }
  );
}

async function reserveLimitedClick(url, now, urlModel) {
  return urlModel
    .findOneAndUpdate(
      {
        _id: url._id,
        code: url.code,
        isActive: true,
        clickLimit: url.clickLimit,
        clicks: { $lt: url.clickLimit },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
      },
      { $inc: { clicks: 1 } },
      { new: true }
    )
    .lean();
}

async function currentLinkState(code, urlModel) {
  return urlModel
    .findOne({ code })
    .select("isActive expiresAt clicks clickLimit")
    .lean();
}

async function redirectAvailableLink(
  request,
  response,
  url,
  now,
  dependencies
) {
  const { urlModel } = dependencies;
  if (isExpired(url, now)) {
    return respondUnavailable(response, url, now);
  }
  let redirectUrl = url;
  let countAlreadyIncremented = false;

  if (url.clickLimit !== null && url.clickLimit !== undefined) {
    redirectUrl = await reserveLimitedClick(url, now, urlModel);
    if (!redirectUrl) {
      return respondUnavailable(
        response,
        await currentLinkState(url.code, urlModel),
        now
      );
    }
    countAlreadyIncremented = true;
  }

  response.redirect(302, redirectUrl.longUrl);
  scheduleClick(request, redirectUrl, dependencies, countAlreadyIncremented);
}

function isValidCode(code) {
  return typeof code === "string" && /^[A-Za-z0-9_-]{1,30}$/.test(code);
}

async function findLink(code, urlModel) {
  return urlModel
    .findOne({ code })
    .select("code longUrl isActive expiresAt clickLimit clicks +passwordHash")
    .lean();
}

export async function redirectToUrl(
  request,
  response,
  next,
  {
    urlModel = Url,
    clickModel = Click,
    schedule = setImmediate,
    now = () => new Date()
  } = {}
) {
  const { code } = request.params;
  if (!isValidCode(code)) {
    return response.status(404).json({ error: "Short link not found." });
  }

  try {
    const url = await findLink(code, urlModel);
    const timestamp = now();
    if (!url || !url.isActive || isExpired(url, timestamp)) {
      return respondUnavailable(response, url, timestamp);
    }
    if (url.passwordHash) {
      return renderPasswordForm(response, code);
    }

    await redirectAvailableLink(
      request,
      response,
      url,
      now(),
      { urlModel, clickModel, schedule }
    );
  } catch (error) {
    next(error);
  }
}

export async function verifyPassword(
  request,
  response,
  next,
  {
    urlModel = Url,
    clickModel = Click,
    schedule = setImmediate,
    now = () => new Date()
  } = {}
) {
  const { code } = request.params;
  if (!isValidCode(code)) {
    return response.status(404).json({ error: "Short link not found." });
  }
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body) ||
    Object.keys(request.body).some((field) => field !== "password")
  ) {
    return response.status(400).json({ error: "Request body must contain only a password." });
  }

  try {
    const url = await findLink(code, urlModel);
    const timestamp = now();
    if (!url || !url.isActive || isExpired(url, timestamp)) {
      return respondUnavailable(response, url, timestamp);
    }
    if (!url.passwordHash) {
      return response.status(400).json({ error: "This short link does not require password verification." });
    }
    if (typeof request.body?.password !== "string" ||
        !(await verifyLinkPassword(request.body.password, url.passwordHash))) {
      return renderPasswordForm(response, code, 401, "The password is incorrect. Please try again.");
    }

    await redirectAvailableLink(
      request,
      response,
      url,
      now(),
      { urlModel, clickModel, schedule }
    );
  } catch (error) {
    next(error);
  }
}
