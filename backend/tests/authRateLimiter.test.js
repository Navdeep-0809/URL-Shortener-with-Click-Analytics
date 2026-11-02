import assert from "node:assert/strict";
import test from "node:test";
import app from "../src/app.js";

test("limits repeated sign-in attempts", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/auth/login`;
  const request = () => fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "incorrect" })
  });

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal((await request()).status, 401);
    }

    const response = await request();
    assert.equal(response.status, 429);
    assert.match((await response.json()).error, /sign-in attempts/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
