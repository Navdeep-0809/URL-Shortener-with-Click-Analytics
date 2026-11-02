import assert from "node:assert/strict";
import test from "node:test";
import app from "../src/app.js";

test("POST /api/urls rejects invalid input before database access", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}/api/urls`;

  try {
    for (const body of [
      {},
      { longUrl: "javascript:alert(1)" },
      { longUrl: "https://example.com", clicks: 99 },
      []
    ]) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, "string");
    }

    const invalidJson = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{"
    });
    assert.equal(invalidJson.status, 400);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("user link management is protected by bearer authentication", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const linksResponse = await fetch(`${baseUrl}/api/urls`);
    assert.equal(linksResponse.status, 401);

    const registrationResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "short" })
    });

    assert.equal(registrationResponse.status, 400);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("limits password verification attempts", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/urls/not.a.link/verify`;

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "incorrect-password" })
      });
      assert.equal(response.status, 404);
    }

    const limited = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "incorrect-password" })
    });
    assert.equal(limited.status, 429);
    assert.match((await limited.json()).error, /password attempts/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
