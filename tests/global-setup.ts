import type { GlobalSetupContext } from "vitest/node";

type GlobalSetup = (ctx: GlobalSetupContext) => Promise<void | (() => void | Promise<void>)>;

const setup: GlobalSetup = async () => {
  const { resetTestDb } = await import("./helpers/db.js");
  await resetTestDb();
  return async () => {
    const { closePool } = await import("../src/db/pool.js");
    await closePool();
  };
};

export default setup;
