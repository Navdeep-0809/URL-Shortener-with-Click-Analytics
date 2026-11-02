import assert from "node:assert/strict";
import test from "node:test";
import app from "../src/app.js";

test("limits anonymous link creation and returns a useful 429 response", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/urls`;

  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      assert.equal(response.status, 400);
    }

    const limitedResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(limitedResponse.status, 429);
    assert.match((await limitedResponse.json()).error, /Too many links/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
