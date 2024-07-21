import fs from "fs";
import { ensureEnvVar, prettyPrintFee } from "./util";
import { ethers, Wallet } from "ethers";
import {
  Contract,
  json,
  Account,
  uint256,
  hash,
  ProviderInterface,
  EthSigner,
  CallData,
  cairo,
  addAddressPadding,
  encode,
} from "starknet";

import * as dotenv from "dotenv";
dotenv.config();

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// TODO: calculate this
// Cairo 0 Old
// const ACCOUNT_CLASS_HASH = "0x4d07e40e93398ed3c76981e72dd1fd22557a78ce36c0515f679e27f0bb5bc5f";
// Cairo 0
// const ACCOUNT_CLASS_HASH = "0x05c478ee27f2112411f86f207605b2e2c58cdb647bac0df27f660ef2252359c6";
// New Cairo
const DEFAULT_TOKEN_ADDRESS = "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
const UDC_ADDRESS = "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf";

// Default to Cairo 1
const ACCOUNT_CLASS_HASH =
  process.env.ACCOUNT_CLASS_HASH || "0x00903752516de5c04fe91600ca6891e325278b2dfc54880ae11a809abb364844";

export class EthWallet {
  public account: Account;
  private privateKey: string;
  private signer: EthSigner;

  constructor(privateKey: string, provider: ProviderInterface, address: string) {
    // if (address == undefined) {
    //   address = EthWallet.computeAddressFromPk(privateKey);
    // }
    const ethSigner = new EthSigner(privateKey);
    this.account = EthWallet.getAccountFromPk(address, privateKey, provider);
    this.privateKey = privateKey;
    this.signer = ethSigner;
    return;
  }

  getPrivateKey() {
    return this.privateKey;
  }

  getPublicKey() {
    return this.account.signer.getPubKey();
  }

  getAddress() {
    return this.account.address;
  }

  static computeAddressFromPk(pk: string): string {
    // const ethSigner = new EthSigner(pk);
    let w = new Wallet(pk);
    console.log("PrKey", pk);
    // let ethPubKey = await ethSigner.getPubKey();
    // console.log("PupKey", ethPubKey);
    let pubKeyTrimmed = w.publicKey.substring(4);
    let ethersPubKey = `0x${pubKeyTrimmed}`;
    console.log("Ethers PubKey", ethersPubKey);
    let ethFullPublicKey = ethersPubKey;

    const pubKeyETHx = cairo.uint256(addAddressPadding(encode.addHexPrefix(ethFullPublicKey.slice(4, -64))));
    let salt = pubKeyETHx.low;
    // const myCallData = new CallData(compiledEthAccount.abi);

    // const accountETHconstructorCalldata = myCallData.compile("constructor", {
    //   public_key: ethFullPublicKey,
    // });
    const compiledEthAccount = json.parse(fs.readFileSync("./artifacts/cairo2/EthAccount.json").toString("ascii"));
    const myCallData = new CallData(compiledEthAccount.abi);
    const accountETHconstructorCalldata = myCallData.compile("constructor", {
      public_key: ethFullPublicKey,
    });
    const contractETHAccountAddress = hash.calculateContractAddressFromHash(
      salt,
      ACCOUNT_CLASS_HASH,
      accountETHconstructorCalldata,
      0,
    );

    return contractETHAccountAddress;
  }

  static getAccountFromPk(address: string, pk: string, provider: ProviderInterface): Account {
    const ethSigner = new EthSigner(pk);
    let w = new Wallet(pk);
    console.log("PrKey", pk);
    let pubKeyTrimmed = w.publicKey.substring(4);
    let ethersPubKey = `0x${pubKeyTrimmed}`;
    console.log("Ethers PubKey", ethersPubKey);
    let ethFullPublicKey = ethersPubKey;

    const pubKeyETHx = cairo.uint256(addAddressPadding(encode.addHexPrefix(ethFullPublicKey.slice(4, -64))));
    let salt = pubKeyETHx.low;

    let account = new Account(provider, address, ethSigner);
    return account;
  }

  async getBalance(tokenAddress?: string) {
    return EthWallet.getBalance(this.account.address, this.account, tokenAddress);
  }

  static async getBalance(address: string, provider: ProviderInterface, tokenAddress?: string): Promise<BigInt> {
    if (tokenAddress == null) {
      tokenAddress = DEFAULT_TOKEN_ADDRESS;
    }
    const erc20ABI = json.parse(fs.readFileSync("./src/interfaces/ERC20_abi.json").toString("ascii"));
    const erc20 = new Contract(erc20ABI, tokenAddress, provider);
    const balance = await erc20.balanceOf(address);
    let balanceBigNumber = uint256.uint256ToBN(balance.balance);
    return balanceBigNumber;
  }

  async deployAccount(): Promise<Account> {
    // Deploy the Account contract and wait for it to be verified on EthWallet.
    console.log("Deployment Tx - Account Contract to EthWallet...");

    let ethFullPublicKey = await this.signer.getPubKey();

    const pubKeyETHx = cairo.uint256(addAddressPadding(encode.addHexPrefix(ethFullPublicKey.slice(4, -64))));
    let salt = pubKeyETHx.low;

    const compiledEthAccount = json.parse(fs.readFileSync("./artifacts/cairo2/EthAccount.json").toString("ascii"));
    const myCallData = new CallData(compiledEthAccount.abi);
    const accountETHconstructorCalldata = myCallData.compile("constructor", {
      public_key: ethFullPublicKey,
    });
    const contractETHAccountAddress = hash.calculateContractAddressFromHash(
      salt,
      ACCOUNT_CLASS_HASH,
      accountETHconstructorCalldata,
      0,
    );

    // let estimateFee = await this.account.estimateAccountDeployFee({
    //   classHash: ACCOUNT_CLASS_HASH,
    //   constructorCalldata: [pubKeyETHx.low, pubKeyETHx.high],
    //   addressSalt: salt,
    //   contractAddress: address,
    // });
    // prettyPrintFee(estimateFee);

    let accountResponse = await this.account.deployAccount({
      classHash: ACCOUNT_CLASS_HASH,
      constructorCalldata: accountETHconstructorCalldata,
      addressSalt: salt,
    });

    // Wait for the deployment transaction to be accepted on EthWallet
    console.log(
      "Waiting for Tx " + accountResponse.transaction_hash + " to be Accepted on Starknet - OZ Account Deployment...",
    );

    return this.account;
  }

  static generateSeed() {
    console.log("THIS IS A NEW ACCOUNT. Please fill in the MNEMONIC field in the .env file");
    let wallet = Wallet.createRandom();
    if (wallet.mnemonic == null) {
      console.log("No mnemonic generated");
      process.exit(1);
    }
    let mnemonic = wallet.mnemonic;
    console.log("12-word seed: " + mnemonic.phrase);
    return mnemonic.phrase;
  }

  async transfer(recipientAddress: string, amount: BigInt, tokenAddress?: string, decimals: number = 18) {
    if (tokenAddress == null) {
      tokenAddress = DEFAULT_TOKEN_ADDRESS;
    }

    const erc20ABI = json.parse(fs.readFileSync("./src/interfaces/ERC20_abi.json").toString("ascii"));
    const erc20 = new Contract(erc20ABI, tokenAddress, this.account);

    let uint256Amount = uint256.bnToUint256(amount.valueOf());

    let estimateFee = await this.account.estimateInvokeFee({
      contractAddress: tokenAddress,
      entrypoint: "transfer",
      calldata: [recipientAddress, uint256Amount.low, uint256Amount.high],
    });
    prettyPrintFee(estimateFee);

    const { transaction_hash: transferTxHash } = await this.account.execute(
      {
        contractAddress: tokenAddress,
        entrypoint: "transfer",
        calldata: [recipientAddress, uint256Amount.low, uint256Amount.high],
      },
      undefined, // abi
      { maxFee: estimateFee.suggestedMaxFee * 5n },
    );
    console.log("Awaiting tx ", transferTxHash);
    await this.account.waitForTransaction(transferTxHash);
    console.log("Tx mined ", transferTxHash);
  }

  async deploy(classHash: string, salt: string, unique: boolean, constructorArgs: string[]) {
    let estimateFee = await this.account.estimateDeployFee({
      classHash: classHash,
      salt: salt,
      unique: unique,
      constructorCalldata: constructorArgs.length > 0 ? this.toRawCallData(constructorArgs) : undefined,
    });
    prettyPrintFee(estimateFee);

    const { transaction_hash: txHash } = await this.account.deploy(
      {
        classHash: classHash,
        salt: salt,
        unique: unique,
        constructorCalldata: constructorArgs.length > 0 ? this.toRawCallData(constructorArgs) : undefined,
      },
      { maxFee: (estimateFee.suggestedMaxFee * 112n) / 100n },
    );

    console.log("Awaiting tx ", txHash);
    await this.account.waitForTransaction(txHash);
    console.log("Tx mined ", txHash);
  }

  async declareNewContract(filename: string, classHash?: string, casmFilename?: string, compiledClassHash?: string) {
    const compiledContract = json.parse(fs.readFileSync(filename).toString("ascii"));

    let casmContarct = undefined;
    if (casmFilename != null) {
      casmContarct = json.parse(fs.readFileSync(casmFilename).toString("ascii"));
    }

    let estimateFee = await this.account.estimateDeclareFee({
      contract: compiledContract,
      classHash,
      casm: casmContarct,
    });
    prettyPrintFee(estimateFee);

    const { transaction_hash: txHash, class_hash: classHashResult } = await this.account.declare(
      {
        contract: compiledContract,
        classHash,
        casm: casmContarct,
      },
      { maxFee: estimateFee.suggestedMaxFee * 5n },
    );

    console.log("Awaiting tx ", txHash);
    await this.account.waitForTransaction(txHash);
    console.log("Tx mined ", txHash, "Declared class", classHashResult);
  }

  async invoke(contractAddress: string, selector: string, calldata: string[]) {
    let call = {
      contractAddress: contractAddress,
      entrypoint: selector,
      calldata: this.toRawCallData(calldata),
    };

    console.log("Call", call);

    let estimateFee = await this.account.estimateInvokeFee(call);
    prettyPrintFee(estimateFee);

    // alternatively execute by calling the account execute function
    const { transaction_hash: transferTxHash } = await this.account.execute(
      call,
      undefined, // abi
      { maxFee: estimateFee.suggestedMaxFee * 2n },
    );
    console.log("Awaiting tx ", transferTxHash);
    await this.account.waitForTransaction(transferTxHash);
    console.log("Tx mined ", transferTxHash);
  }

  async call(contractAddress: string, selector: string, calldata: string[]) {
    let result = await this.account.callContract({
      contractAddress: contractAddress,
      entrypoint: selector,
      calldata: this.toRawCallData(calldata),
    });
    console.log("Result", result);
  }

  toRawCallData(calldata: string[]): string[] {
    let rawCallData = new Array<string>();

    for (let c of calldata) {
      rawCallData.push(BigInt(c).toString());
    }
    return rawCallData;
  }
}
