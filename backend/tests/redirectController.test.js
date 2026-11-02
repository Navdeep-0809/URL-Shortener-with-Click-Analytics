import assert from "node:assert/strict";
import test from "node:test";
import { redirectToUrl } from "../src/controllers/redirectController.js";

function createRequest(code) {
  return { params: { code } };
}

test("redirects with HTTP 302 and schedules an atomic click increment", async () => {
  let scheduledUpdate;
  let update;
  let clickRecord;
  let redirect;
  const urlModel = {
    findOne(query) {
      assert.deepEqual(query, { code: "short123" });
      return {
        select(fields) {
          assert.equal(fields, "code longUrl isActive expiresAt clickLimit clicks +passwordHash");
          return {
            async lean() {
              return {
                _id: "url-id",
                longUrl: "https://example.com/",
                isActive: true
              };
            }
          };
        }
      };
    },
    updateOne(filter, operation) {
      update = { filter, operation };
      return { exec: async () => ({ modifiedCount: 1 }) };
    }
  };
  const clickModel = {
    async create(record) {
      clickRecord = record;
      return record;
    }
  };
  const response = {
    redirect(status, destination) {
      redirect = { status, destination };
    },
    status() {
      throw new Error("Unexpected error response.");
    }
  };

  await redirectToUrl(
    createRequest("short123"),
    response,
    (error) => {
      throw error;
    },
    {
      urlModel,
      clickModel,
      schedule(callback) {
        scheduledUpdate = callback;
      }
    }
  );

  assert.deepEqual(redirect, { status: 302, destination: "https://example.com/" });
  assert.equal(update, undefined);
  scheduledUpdate();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(update, {
    filter: { _id: "url-id" },
    operation: { $inc: { clicks: 1 } }
  });
  assert.equal(clickRecord.urlId, "url-id");
});

test("returns 404 for a missing short code without redirecting", async () => {
  let statusCode;
  const urlModel = {
    findOne() {
      return { select: () => ({ lean: async () => null }) };
    }
  };
  const response = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(payload) {
      assert.equal(payload.error, "Short link not found.");
    }
  };

  await redirectToUrl(createRequest("missing1"), response, (error) => {
    throw error;
  }, { urlModel });
  assert.equal(statusCode, 404);
});

test("returns 410 for a disabled short link", async () => {
  let statusCode;
  const urlModel = {
    findOne() {
      return {
        select: () => ({
          lean: async () => ({ longUrl: "https://example.com/", isActive: false })
        })
      };
    }
  };
  const response = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(payload) {
      assert.equal(payload.error, "This short link is disabled.");
    }
  };

  await redirectToUrl(createRequest("short123"), response, (error) => {
    throw error;
  }, { urlModel });
  assert.equal(statusCode, 410);
});
