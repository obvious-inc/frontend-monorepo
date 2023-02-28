import { test, mock, assert, assertEqual, assertCalled } from "./test-utils.js";
import { generateX25519KeyPair } from "@waku/noise";
import { randomString } from "@stablelib/random";
import { createDummyNetwork, createNode } from "./protocol-poc.mjs";

// const generateX25519KeyPair = () => new Uint8Array();

test("basic", async () => {
  const network = createDummyNetwork();

  const aliceNode = createNode({
    account: generateX25519KeyPair(),
    network,
  });
  const bobNode = createNode({
    account: generateX25519KeyPair(),
    network,
  });

  {
    // Alice writes to Bob
    const message = { foo: randomString(32) };
    const listener = mock((incomingMessage, protocol) => {
      assertEqual(message.foo, incomingMessage.foo);
      assertEqual(protocol, "dh");
    });
    const unobserve = bobNode.observe(listener);
    aliceNode.sendPrivate(bobNode.accountPublicKey, message);
    await network._idle();
    unobserve();
    assertCalled(listener);
  }

  for (let i = 0; i < 5; i++) {
    {
      // Alice writes to Bob
      const message = { foo: randomString(32) };
      const listener = mock((incomingMessage, protocol) => {
        assertEqual(message.foo, incomingMessage.foo);
        assertEqual(protocol, "noise");
      });
      const unobserve = bobNode.observe(listener);
      aliceNode.sendPrivate(bobNode.accountPublicKey, message);
      await network._idle();
      unobserve();
      assertCalled(listener);
    }

    {
      // Bob writes to Alice
      const message = { foo: randomString(32) };
      const listener = mock((incomingMessage, protocol) => {
        assertEqual(message.foo, incomingMessage.foo);
        assertEqual(protocol, "noise");
      });
      const unobserve = aliceNode.observe(listener);
      bobNode.sendPrivate(aliceNode.accountPublicKey, message);
      await network._idle();
      unobserve();
      assertCalled(listener);
    }
  }
});

// Waku’s noise implementation does name tag checking which enforces messages to
// arrive in order. To allow for out-of-order message this POC caches and
// continously tries to replay failed encryption attempts as new messages arrive.
test("out-of-order messages", async () => {
  const network = createDummyNetwork();

  const aliceNode = createNode({
    account: generateX25519KeyPair(),
    network,
  });
  const bobNode = createNode({
    account: generateX25519KeyPair(),
    network,
  });

  // Get the handshake over with first since we only care about out-of-order
  // messages on noise sessions
  aliceNode.sendPrivate(bobNode.accountPublicKey, {
    foo: "handshake",
  });
  await network._idle();

  const sentMessages = [];
  const receivedMessages = [];

  const listener = mock((incomingMessage) => {
    receivedMessages.push(incomingMessage);
  });
  const unobserveAlice = aliceNode.observe(listener);
  const unobserveBob = bobNode.observe(listener);

  const exchanges = 10;

  for (let i = 0; i < exchanges; i++) {
    const [aliceMessage, bobMessage] = ["alice", "bob"].map((name) => ({
      payload: `${name} ${i}`,
    }));
    aliceNode.sendPrivate(bobNode.accountPublicKey, aliceMessage);
    bobNode.sendPrivate(aliceNode.accountPublicKey, bobMessage);
    sentMessages.push(aliceMessage, bobMessage);
  }

  await network._idle();

  unobserveAlice();
  unobserveBob();

  assertEqual(receivedMessages.length, exchanges * 2);
  // Just to make sure we didn’t get perfect order by chance
  assert(receivedMessages.some((m, i) => m !== sentMessages[i]));
  console.log(sentMessages, receivedMessages);
});
