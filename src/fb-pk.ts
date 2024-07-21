import fs from "fs";
import * as path from "path";
import { FireblocksSDK } from "fireblocks-sdk";
import { abort } from "./util";
import { utils } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.FIREBLOCKS_API_KEY ?? abort("Must provide api key");
const apiSecretPath = process.env.FIREBLOCKS_SECRET_PATH ?? abort("Must provide secret path");
let accountAddress = process.env.ACCOUNT_ADDRESS ?? abort("Must provide account address");

const apiSecret = fs.readFileSync(path.resolve(apiSecretPath), "utf8");

// Choose the right api url for your workspace type
const baseUrl = "https://sandbox-api.fireblocks.io";
const fireblocks = new FireblocksSDK(apiSecret, apiKey, baseUrl);
(async () => {
  const PublicKeyInfoArgs = {
    // This is the same as the valut name
    assetId: "ETH_TEST5",
    // This is what is returned from the get valuts call
    vaultAccountId: 1,
    change: 0,
    addressIndex: 0,
    compressed: false,
  };

  const result = await fireblocks.getPublicKeyInfoForVaultAccount(PublicKeyInfoArgs);
  console.log(result);

  let pubKey = `0x${result.publicKey}`;
  console.log("Uncompressed Public Key: ", pubKey);
  console.log("Address: ", utils.computeAddress(pubKey));
})().catch(e => {
  console.error(`Failed: ${e}`);
  process.exit(-1);
});
