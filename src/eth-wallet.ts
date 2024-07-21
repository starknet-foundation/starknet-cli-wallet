import { ensureEnvVar } from "./util";
import { program } from "commander";
import { getProvider } from "./ProviderConfig";
import { ethers } from "ethers";

import { EthWallet } from "./EthWallet";

import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const MNEMONIC = process.env.MNEMONIC || "";
const ACCOUNT_ADDRESS = process.env.ACCOUNT_ADDRESS;

// Sepolia by default
const STARKNET_RPC_URL = process.env.STARKNET_RPC_URL || "https://starknet-sepolia.public.blastapi.io";

async function getWalletFromConfig(): Promise<EthWallet> {
  let accountAddress = ACCOUNT_ADDRESS;
  if (ACCOUNT_ADDRESS == undefined) {
    accountAddress = EthWallet.computeAddressFromPk(PRIVATE_KEY);
    console.log("Account Address: ", accountAddress);
    let provider = getProvider(STARKNET_RPC_URL);
    return new EthWallet(PRIVATE_KEY, provider, accountAddress);
  }
  process.exit(0);
}

program.command("balance [address] [token_address]").action(async (address: string, tokenAddress: string, options) => {
  let provider = getProvider(STARKNET_RPC_URL);
  let res = provider.getInvokeEstimateFee;
  if (address == undefined) {
    let wallet = await getWalletFromConfig();
    let balanceBigNumber = await wallet.getBalance(tokenAddress);
    console.log(`Address ${wallet.getAddress()}`);
    console.log(`Balance ${ethers.utils.formatEther(balanceBigNumber.toString())}`);
  } else {
    let balanceBigNumber = await EthWallet.getBalance(address, provider, tokenAddress);
    console.log(`Address ${address}`);
    console.log(`Balance ${ethers.utils.formatEther(balanceBigNumber.toString())}`);
  }
});

program
  .command("transfer <recipientAddress> <amount>")
  .option("-t --token <token>")
  .option("-d --decimals <decimals>")
  .action(async (recipientAddress: string, amount: string, options) => {
    if (recipientAddress == null) {
      console.warn("Must specify a destination address to trasnfer to");
    }

    let decimals = 18;
    if (options.decimals == null) {
      decimals = options.decimals;
    }
    let tokenAddress = options.token;
    if (tokenAddress == null) {
      tokenAddress = ensureEnvVar("TOKEN_ADDRESS");
    }
    let wallet = await getWalletFromConfig();
    console.log(`Transfering ${amount} tokens ${tokenAddress} to ${recipientAddress}`);
    await wallet.transfer(recipientAddress, ethers.utils.parseUnits(amount, decimals).toBigInt(), tokenAddress);
  });

program
  .command("declare <filename> [casm_filename]")
  .option("-ch --class_hash <classHash>")
  .option("-cch --compiled_class_hash <compiledClassHash>")
  .action(async (filename: string, casm_filename: string, options) => {
    let wallet = await getWalletFromConfig();
    await wallet.declareNewContract(filename, options.classHash, casm_filename, options.compiledClassHash);
  });

program
  .command("deploy <classHash> <salt> [constructorArgs...]")
  .option("-u --unique")
  .action(async (classHash: string, salt: string, constructorArgs: string[], options) => {
    let wallet = await getWalletFromConfig();
    await wallet.deploy(classHash, salt, options.unique, constructorArgs);
  });

program.command("deploy_account").action(async (classHash: string, constructorArgs: string[], options) => {
  let wallet = await getWalletFromConfig();
  console.log("Deploy Wallet", wallet.account.address);
  await wallet.deployAccount();
});

program
  .command("invoke <contractAddress>  <selector> [calldata...]")
  .action(async (contractAddress: string, selector: string, calldata: string[], options) => {
    let wallet = await getWalletFromConfig();
    await wallet.invoke(contractAddress, selector, calldata);
  });

program
  .command("call <contractAddress>  <selector> [calldata...]")
  .action(async (contractAddress: string, selector: string, calldata: string[], options) => {
    let wallet = await getWalletFromConfig();
    await wallet.call(contractAddress, selector, calldata);
  });

program.command("generate_seed").action(async options => {
  EthWallet.generateSeed();
});

program.command("address").action(async options => {
  let wallet = await getWalletFromConfig();
  console.log(`Account address: ${wallet.getAddress()}`);
});

program.command("get_keys").action(async options => {
  let wallet = await getWalletFromConfig();
  console.log(`Account address: ${wallet.getAddress()}`);
  console.log(`Account PrivateKey: ${wallet.getPrivateKey()}`);
  console.log(`Account PublicKey: ${await wallet.getPublicKey()}`);
});

program.parse(process.argv);
