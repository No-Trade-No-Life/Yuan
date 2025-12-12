import { createKeyPair, signMessage, verifyMessage, decodeBase58, encodeBase58 } from '@yuants/utils';
import { makeSecret } from '../src/makeSecret';
import { verifySecretSigner } from '../src/verifySecretSigner';
import { getTagsText } from '../src/utils';
import { performance } from 'perf_hooks';

async function benchmarkMakeSecret(iterations: number = 1000) {
  const keyPair = createKeyPair();
  const readerKeyPair = createKeyPair();
  const secretData = new Uint8Array(32); // 32 bytes of dummy data
  crypto.getRandomValues(secretData);

  const tags = { env: 'test', user: 'benchmark' };

  console.log(`Benchmarking makeSecret for ${iterations} iterations...`);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await makeSecret(secretData, tags, readerKeyPair.public_key, keyPair);
  }
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;
  console.log(`Total time: ${total.toFixed(2)} ms`);
  console.log(`Average per call: ${avg.toFixed(3)} ms`);
  console.log(`Calls per second: ${(1000 / avg).toFixed(1)}`);
  return { total, avg };
}

async function benchmarkVerifySecretSigner(iterations: number = 1000) {
  const keyPair = createKeyPair();
  const readerKeyPair = createKeyPair();
  const secretData = new Uint8Array(32);
  crypto.getRandomValues(secretData);
  const tags = { env: 'test', user: 'benchmark' };

  // Create a single secret record to verify repeatedly
  const secretRecord = await makeSecret(secretData, tags, readerKeyPair.public_key, keyPair);

  console.log(`Benchmarking verifySecretSigner for ${iterations} iterations...`);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    verifySecretSigner(secretRecord);
  }
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;
  console.log(`Total time: ${total.toFixed(2)} ms`);
  console.log(`Average per call: ${avg.toFixed(3)} ms`);
  console.log(`Calls per second: ${(1000 / avg).toFixed(1)}`);
  return { total, avg };
}

async function benchmarkCombined(iterations: number = 1000) {
  const keyPair = createKeyPair();
  const readerKeyPair = createKeyPair();
  const secretData = new Uint8Array(32);
  crypto.getRandomValues(secretData);
  const tags = { env: 'test', user: 'benchmark' };

  console.log(`Benchmarking makeSecret + verifySecretSigner combined for ${iterations} iterations...`);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const secretRecord = await makeSecret(secretData, tags, readerKeyPair.public_key, keyPair);
    verifySecretSigner(secretRecord);
  }
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;
  console.log(`Total time: ${total.toFixed(2)} ms`);
  console.log(`Average per call: ${avg.toFixed(3)} ms`);
  console.log(`Calls per second: ${(1000 / avg).toFixed(1)}`);
  return { total, avg };
}

// ===== Fine-grained benchmark functions =====

function benchmarkGetTagsText(iterations: number = 100000) {
  const tags = { env: 'test', user: 'benchmark', app: 'secret-service', version: '1.0.0' };

  console.log(`Benchmarking getTagsText for ${iterations} iterations...`);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    getTagsText(tags);
  }
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;
  console.log(`Total time: ${total.toFixed(2)} ms`);
  console.log(`Average per call: ${avg.toFixed(6)} ms`);
  console.log(`Calls per second: ${(1000 / avg).toFixed(0)}`);
  return { total, avg };
}

function benchmarkMessageConstruction(iterations: number = 100000) {
  const signer = 'signer123';
  const reader = 'reader456';
  const tags = { env: 'test', user: 'benchmark' };
  const data = 'encryptedDataBase64String';
  const tagsText = getTagsText(tags);

  console.log(`Benchmarking message construction for ${iterations} iterations...`);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const message = signer + reader + tagsText + data;
  }
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;
  console.log(`Total time: ${total.toFixed(2)} ms`);
  console.log(`Average per call: ${avg.toFixed(6)} ms`);
  console.log(`Calls per second: ${(1000 / avg).toFixed(0)}`);
  return { total, avg };
}

function benchmarkVerifyMessage(iterations: number = 10000) {
  const keyPair = createKeyPair();
  const message = 'test message for signature verification';
  const signature = signMessage(message, keyPair.private_key);

  console.log(`Benchmarking verifyMessage for ${iterations} iterations...`);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    verifyMessage(message, signature, keyPair.public_key);
  }
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;
  console.log(`Total time: ${total.toFixed(2)} ms`);
  console.log(`Average per call: ${avg.toFixed(5)} ms`);
  console.log(`Calls per second: ${(1000 / avg).toFixed(1)}`);
  return { total, avg };
}

function benchmarkSignMessage(iterations: number = 10000) {
  const keyPair = createKeyPair();
  const message = 'test message for signing';

  console.log(`Benchmarking signMessage for ${iterations} iterations...`);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    signMessage(message, keyPair.private_key);
  }
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;
  console.log(`Total time: ${total.toFixed(2)} ms`);
  console.log(`Average per call: ${avg.toFixed(5)} ms`);
  console.log(`Calls per second: ${(1000 / avg).toFixed(1)}`);
  return { total, avg };
}

function benchmarkDecodeBase58(iterations: number = 100000) {
  // Generate a sample base58 string
  const keyPair = createKeyPair();
  const base58String = keyPair.public_key; // This is base58 encoded

  console.log(`Benchmarking decodeBase58 for ${iterations} iterations...`);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    decodeBase58(base58String);
  }
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;
  console.log(`Total time: ${total.toFixed(2)} ms`);
  console.log(`Average per call: ${avg.toFixed(6)} ms`);
  console.log(`Calls per second: ${(1000 / avg).toFixed(0)}`);
  return { total, avg };
}

function benchmarkTextEncoder(iterations: number = 100000) {
  const message = 'test message for text encoding';

  console.log(`Benchmarking TextEncoder for ${iterations} iterations...`);
  const encoder = new TextEncoder();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    encoder.encode(message);
  }
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;
  console.log(`Total time: ${total.toFixed(2)} ms`);
  console.log(`Average per call: ${avg.toFixed(6)} ms`);
  console.log(`Calls per second: ${(1000 / avg).toFixed(0)}`);
  return { total, avg };
}

async function main() {
  console.log('=== Secret Library Performance Benchmark ===\n');
  console.log('Focus: makeSecret and verifySecretSigner\n');

  // Warm up
  console.log('Warming up...');
  await benchmarkMakeSecret(10);
  await benchmarkVerifySecretSigner(10);

  // Actual benchmarks
  console.log('\n--- makeSecret Benchmark ---');
  const makeSecretResult = await benchmarkMakeSecret(1000);

  console.log('\n--- verifySecretSigner Benchmark ---');
  const verifyResult = await benchmarkVerifySecretSigner(10000); // More iterations for synchronous function

  console.log('\n--- Combined Workflow Benchmark ---');
  const combinedResult = await benchmarkCombined(500); // Fewer iterations due to async crypto

  console.log('\n--- Fine-grained Benchmarks ---');

  console.log('\n1. Component-level benchmarks:');
  const tagsTextResult = benchmarkGetTagsText(100000);
  const messageConstructionResult = benchmarkMessageConstruction(100000);
  const decodeBase58Result = benchmarkDecodeBase58(100000);
  const textEncoderResult = benchmarkTextEncoder(100000);

  console.log('\n2. Crypto primitive benchmarks:');
  const signMessageResult = benchmarkSignMessage(10000);
  const verifyMessageResult = benchmarkVerifyMessage(10000);

  console.log('\n3. verifySecretSigner breakdown (using previous result):');

  console.log('\n--- Summary ---');
  console.log(`makeSecret average: ${makeSecretResult.avg.toFixed(3)} ms`);
  console.log(`verifySecretSigner average: ${verifyResult.avg.toFixed(5)} ms`);
  console.log(`Combined average: ${combinedResult.avg.toFixed(3)} ms`);
  console.log(`\nPerformance analysis:`);
  console.log(
    `- makeSecret dominates total time: ${((makeSecretResult.avg / combinedResult.avg) * 100).toFixed(
      1,
    )}% of combined workflow`,
  );
  console.log(
    `- verifySecretSigner is ${(makeSecretResult.avg / verifyResult.avg).toFixed(0)}x faster than makeSecret`,
  );

  console.log(`\nFine-grained analysis of verifySecretSigner (~${verifyResult.avg.toFixed(3)} ms):`);
  console.log(
    `  - getTagsText: ${tagsTextResult.avg.toFixed(6)} ms (${(
      (tagsTextResult.avg / verifyResult.avg) *
      100
    ).toFixed(2)}%)`,
  );
  console.log(
    `  - message construction: ${messageConstructionResult.avg.toFixed(6)} ms (${(
      (messageConstructionResult.avg / verifyResult.avg) *
      100
    ).toFixed(2)}%)`,
  );
  console.log(
    `  - decodeBase58 (2x): ${(decodeBase58Result.avg * 2).toFixed(6)} ms (${(
      ((decodeBase58Result.avg * 2) / verifyResult.avg) *
      100
    ).toFixed(2)}%)`,
  );
  console.log(
    `  - TextEncoder.encode: ${textEncoderResult.avg.toFixed(6)} ms (${(
      (textEncoderResult.avg / verifyResult.avg) *
      100
    ).toFixed(2)}%)`,
  );
  console.log(
    `  - verifyMessage (crypto): ${verifyMessageResult.avg.toFixed(5)} ms (${(
      (verifyMessageResult.avg / verifyResult.avg) *
      100
    ).toFixed(2)}%)`,
  );
  console.log(
    `  - estimated overhead: ${(
      verifyResult.avg -
      tagsTextResult.avg -
      messageConstructionResult.avg -
      decodeBase58Result.avg * 2 -
      textEncoderResult.avg -
      verifyMessageResult.avg
    ).toFixed(5)} ms`,
  );

  console.log(`\nCrypto primitive comparison:`);
  console.log(`  - signMessage: ${signMessageResult.avg.toFixed(5)} ms`);
  console.log(`  - verifyMessage: ${verifyMessageResult.avg.toFixed(5)} ms`);
  console.log(`  - ratio (verify/sign): ${(verifyMessageResult.avg / signMessageResult.avg).toFixed(2)}x`);
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  benchmarkMakeSecret,
  benchmarkVerifySecretSigner,
  benchmarkCombined,
  benchmarkGetTagsText,
  benchmarkMessageConstruction,
  benchmarkVerifyMessage,
  benchmarkSignMessage,
  benchmarkDecodeBase58,
  benchmarkTextEncoder,
};
