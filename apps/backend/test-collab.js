import WebSocket from "ws";
import assert from "assert";
import fetch from "node-fetch";
const BASE_URL = "http://localhost:3000";

async function runTest() {
  console.log("Starting collaboration server test...");

  // 1. Setup: Create a new document
  const createResponse = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "test-doc", userId: 1 }),
  });
  const { id: documentId } = await createResponse.json();
  console.log(`Created document with ID: ${documentId}`);

  // 2. Connect two clients
  const clientA = new WebSocket(`${BASE_URL.replace("http", "ws")}`);
  const clientB = new WebSocket(`${BASE_URL.replace("http", "ws")}`);

  let clientAReceivedAck = false;
  let clientBReceivedBroadcast = false;
  let clientBReceivedMismatch = false;

  await new Promise((resolve) => clientA.on("open", resolve));
  await new Promise((resolve) => clientB.on("open", resolve));
  console.log("Clients connected.");

  // 3. Test 1: Simple Edit and Broadcast
  clientA.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.message === "success") {
      console.log(`[Client A] Received ack for V${data.version}.`);
      if (data.version === 1) clientAReceivedAck = true;
      if (data.version === 2) clientAReceivedAckV2 = true;
    }
  });

  clientB.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.steps && data.version === 1) {
      console.log("[Client B] Received broadcast for V1.");
      clientBReceivedBroadcast = true;
    }
    if (data.error === "Version mismatch") {
      console.log("[Client B] Received expected version mismatch.");
      clientBReceivedMismatch = true;
    }
  });

  const step1 = { type: "InsertCharCommand", pos: 0, char: "a" };
  clientA.send(
    JSON.stringify({
      documentId,
      version: 0,
      steps: [step1],
      clientID: "A",
    }),
  );

  await waitFor(
    () => clientAReceivedAck && clientBReceivedBroadcast,
    "Test 1 timeout",
  );
  assert.ok(clientAReceivedAck, "Test 1 Failed: Client A did not receive ack.");
  assert.ok(
    clientBReceivedBroadcast,
    "Test 1 Failed: Client B did not receive broadcast.",
  );
  console.log("Test 1 Passed: Simple broadcast and acknowledgement.");

  // 4. Test 2: Concurrent Edit and Conflict
  let clientAReceivedAckV2 = false;
  const step2A = { type: "InsertCharCommand", pos: 1, char: "b" };
  clientA.send(
    JSON.stringify({
      documentId,
      version: 1,
      steps: [step2A],
      clientID: "A",
    }),
  );

  // Wait for the server to process A's change
  await waitFor(() => clientAReceivedAckV2, "Test 2 timeout on ack V2");

  // NOW, send B's change based on the old version
  const step2B = { type: "InsertCharCommand", pos: 1, char: "c" };
  clientB.send(
    JSON.stringify({
      documentId,
      version: 1, // This is now guaranteed to be the wrong version
      steps: [step2B],
      clientID: "B",
    }),
  );

  await waitFor(() => clientBReceivedMismatch, "Test 2 timeout on mismatch");
  assert.ok(
    clientBReceivedMismatch,
    "Test 2 Failed: Client B did not receive version mismatch.",
  );
  console.log("Test 2 Passed: Conflict detection.");

  // 5. Test 2b: Catch-up
  const catchUpResponse = await fetch(
    `${BASE_URL}/api/documents/${documentId}/steps?since=1`,
  );
  const catchUpData = await catchUpResponse.json();
  assert.strictEqual(
    catchUpData.steps.length,
    1,
    "Test 2b Failed: Did not fetch correct number of steps.",
  );
  assert.deepStrictEqual(
    catchUpData.steps[0],
    step2A,
    "Test 2b Failed: Fetched steps do not match.",
  );
  console.log("Test 2b Passed: Catch-up via GET /steps.");

  // 6. Test 3: Verify final version
  const finalDocResponse = await fetch(
    `${BASE_URL}/api/documents/${documentId}`,
  );
  const finalDocData = await finalDocResponse.json();
  assert.strictEqual(
    finalDocData.data.ot_version,
    2,
    "Test 3 Failed: Final OT version is incorrect.",
  );
  console.log("Test 3 Passed: Final OT version is correct.");

  // Cleanup
  clientA.close();
  clientB.close();
  console.log("All tests passed!");
  process.exit(0);
}

function waitFor(condition, errorMsg, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const interval = 100;
    const endTime = Date.now() + timeout;
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() > endTime) {
        reject(new Error(errorMsg));
      } else {
        setTimeout(check, interval);
      }
    };
    check();
  });
}

runTest().catch((err) => {
  console.error("Test failed with an error:", err);
  process.exit(1);
});
