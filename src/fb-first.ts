import fs from "fs";
import * as path from "path";
import { FireblocksSDK } from "fireblocks-sdk";
import { abort } from "./util";
const { inspect } = require("util");
import * as dotenv from "dotenv";
dotenv.config();

const apiSecretPath = process.env.FIREBLOCKS_SECRET_PATH ?? abort("Must provide secret path");
const apiSecret = fs.readFileSync(path.resolve(apiSecretPath), "utf8");
const apiKey = process.env.FIREBLOCKS_API_KEY ?? abort("Must provide api key");
const baseUrl = "https://sandbox-api.fireblocks.io";
const fireblocks = new FireblocksSDK(apiSecret, apiKey, baseUrl);

(async () => {
  // Print vaults before creation
  let vaultAccounts = await fireblocks.getVaultAccountsWithPageInfo({});
  console.log(inspect(vaultAccounts, false, null, true));
})().catch(e => {
  console.error(`Failed: ${e}`);
  process.exit(-1);
});
