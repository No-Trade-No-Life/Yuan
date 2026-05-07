#!/usr/bin/env node

const { Terminal } = require('@yuants/protocol');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name}_NOT_SET`);
  }
  return value;
};

const readStringEnv = (name, defaultValue) => {
  const value = process.env[name]?.trim();
  return value || defaultValue;
};

const buildCredential = () => {
  const raw = process.env.VEX_CREDENTIAL_JSON?.trim();
  if (raw) {
    return JSON.parse(raw);
  }
  return {
    type: readStringEnv('VEX_CREDENTIAL_TYPE', 'OKX'),
    payload: {
      access_key: requiredEnv('OKX_ACCESS_KEY'),
      secret_key: requiredEnv('OKX_SECRET_KEY'),
      passphrase: requiredEnv('OKX_PASSPHRASE'),
    },
  };
};

const terminal = Terminal.fromNodeEnv();

const listServiceMethods = () => {
  const methods = new Set();
  for (const terminalInfo of terminal.terminalInfos || []) {
    for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
      if (typeof serviceInfo?.method === 'string') {
        methods.add(serviceInfo.method);
      }
    }
  }
  return methods;
};

const listAccountBoundServices = () => {
  const items = [];
  for (const terminalInfo of terminal.terminalInfos || []) {
    for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
      const method = serviceInfo?.method;
      const accountId = serviceInfo?.schema?.properties?.account_id?.const;
      if (typeof method !== 'string' || typeof accountId !== 'string' || !accountId.trim()) continue;
      items.push({ method, accountId: accountId.trim() });
    }
  }
  return items;
};

const waitForAccountBoundCredential = async (credentialId) => {
  for (let i = 0; i < 60; i += 1) {
    const services = listAccountBoundServices();
    const methods = new Set(
      services.filter((item) => item.accountId === credentialId).map((item) => item.method),
    );
    if (
      ['SubmitOrder', 'CancelOrder', 'QueryPendingOrders', 'QueryAccountInfo'].every((method) =>
        methods.has(method),
      )
    ) {
      return credentialId;
    }
    await sleep(1000);
  }
  throw new Error('WAIT_ACCOUNT_BOUND_SERVICES_TIMEOUT');
};

const waitForVexServices = async () => {
  for (let i = 0; i < 60; i += 1) {
    const methods = listServiceMethods();
    if (methods.has('VEX/RegisterExchangeCredential')) {
      return;
    }
    await sleep(1000);
  }
  throw new Error('WAIT_VEX_SERVICE_TIMEOUT');
};

const resolveCredentialId = async (credential) =>
  terminal.client.requestForResponseData('GetCredentialId', {
    credential,
  });

const main = async () => {
  const credential = buildCredential();
  await waitForVexServices();

  const credentialId = await resolveCredentialId(credential);
  const secret = await terminal.client.requestForResponseData('VEX/RegisterExchangeCredential', credential);
  await waitForAccountBoundCredential(credentialId);
  console.log(
    JSON.stringify(
      {
        registered: true,
        secret_id: secret?.sign,
        credential_id: credentialId,
        type: credential.type,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error('register-vex-credential failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    terminal.dispose();
  });
