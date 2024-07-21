import { FireblocksSDK, PeerType, TransactionOperation, TransactionStatus } from "fireblocks-sdk";

import {
  ArraySignatureType,
  Call,
  DeclareSignerDetails,
  DeployAccountSignerDetails,
  InvocationsSignerDetails,
  Signature,
  TypedData,
  Uint256,
  V2DeclareSignerDetails,
  V2DeployAccountSignerDetails,
  V2InvocationsSignerDetails,
  V3DeclareSignerDetails,
  V3DeployAccountSignerDetails,
  V3InvocationsSignerDetails,
  CallData,
  num,
  stark,
  hash,
  transaction,
  uint256,
  SignerInterface,
  typedData,
  RPC,
} from "starknet";

export type FbSignature = {
  r: string;
  s: string;
  v: number;
};

// This should be changed from sandbox for mainnet usecase
const baseUrl = "https://sandbox-api.fireblocks.io";

/**
 * Signer for accounts using Ethereum signature
 */
export class FbSigner implements SignerInterface {
  protected fireblocks: FireblocksSDK;
  protected publicKey: string; // uncompressed Ethereum public key, starting with 0x04
  protected vaultAccountId: string;
  protected assetId: string;
  protected bip44addressIndex: number;

  constructor(
    apiSecret: string,
    apiKey: string,
    publicKey: string,
    vaultAccountId: string,
    assetId: string,
    bip44addressIndex = 0,
  ) {
    this.fireblocks = new FireblocksSDK(apiSecret, apiKey, baseUrl);
    this.vaultAccountId = vaultAccountId;
    this.publicKey = publicKey;
    this.assetId = assetId;
    this.bip44addressIndex = bip44addressIndex;
  }

  /**
   */
  public async getPubKey(): Promise<string> {
    return this.publicKey;
  }

  public async signMessage(dataWithType: TypedData, accountAddress: string): Promise<Signature> {
    const msgHash = typedData.getMessageHash(dataWithType, accountAddress);
    let sig = await this.fbSign(msgHash);
    return this.formatEthSignature(sig);
  }

  public async signTransaction(transactions: Call[], details: InvocationsSignerDetails): Promise<Signature> {
    const compiledCalldata = transaction.getExecuteCalldata(transactions, details.cairoVersion);
    let msgHash;

    // TODO: How to do generic union discriminator for all like this
    if (Object.values(RPC.ETransactionVersion2).includes(details.version as any)) {
      const det = details as V2InvocationsSignerDetails;
      msgHash = hash.calculateInvokeTransactionHash({
        ...det,
        senderAddress: det.walletAddress,
        compiledCalldata,
        version: det.version,
      });
    } else if (Object.values(RPC.ETransactionVersion3).includes(details.version as any)) {
      const det = details as V3InvocationsSignerDetails;
      msgHash = hash.calculateInvokeTransactionHash({
        ...det,
        senderAddress: det.walletAddress,
        compiledCalldata,
        version: det.version,
        nonceDataAvailabilityMode: stark.intDAM(det.nonceDataAvailabilityMode),
        feeDataAvailabilityMode: stark.intDAM(det.feeDataAvailabilityMode),
      });
    } else {
      throw Error("unsupported signTransaction version");
    }

    let sig = await this.fbSign(msgHash);

    return this.formatEthSignature(sig);
  }

  public async signDeployAccountTransaction(details: DeployAccountSignerDetails): Promise<Signature> {
    const compiledConstructorCalldata = CallData.compile(details.constructorCalldata);
    /*     const version = BigInt(details.version).toString(); */
    let msgHash;

    if (Object.values(RPC.ETransactionVersion2).includes(details.version as any)) {
      const det = details as V2DeployAccountSignerDetails;
      msgHash = hash.calculateDeployAccountTransactionHash({
        ...det,
        salt: det.addressSalt,
        constructorCalldata: compiledConstructorCalldata,
        version: det.version,
      });
    } else if (Object.values(RPC.ETransactionVersion3).includes(details.version as any)) {
      const det = details as V3DeployAccountSignerDetails;
      msgHash = hash.calculateDeployAccountTransactionHash({
        ...det,
        salt: det.addressSalt,
        compiledConstructorCalldata,
        version: det.version,
        nonceDataAvailabilityMode: stark.intDAM(det.nonceDataAvailabilityMode),
        feeDataAvailabilityMode: stark.intDAM(det.feeDataAvailabilityMode),
      });
    } else {
      throw Error("unsupported signDeployAccountTransaction version");
    }
    let sig = await this.fbSign(msgHash);
    return this.formatEthSignature(sig);
  }

  public async signDeclareTransaction(
    // contractClass: ContractClass,  // Should be used once class hash is present in ContractClass
    details: DeclareSignerDetails,
  ): Promise<Signature> {
    let msgHash;

    if (Object.values(RPC.ETransactionVersion2).includes(details.version as any)) {
      const det = details as V2DeclareSignerDetails;
      msgHash = hash.calculateDeclareTransactionHash({
        ...det,
        version: det.version,
      });
    } else if (Object.values(RPC.ETransactionVersion3).includes(details.version as any)) {
      const det = details as V3DeclareSignerDetails;
      msgHash = hash.calculateDeclareTransactionHash({
        ...det,
        version: det.version,
        nonceDataAvailabilityMode: stark.intDAM(det.nonceDataAvailabilityMode),
        feeDataAvailabilityMode: stark.intDAM(det.feeDataAvailabilityMode),
      });
    } else {
      throw Error("unsupported signDeclareTransaction version");
    }

    let sig = await this.fbSign(msgHash);
    return this.formatEthSignature(sig);
  }

  /**
   * Serialize the signature in conformity with starknet::eth_signature::Signature
   * @param ethSignature secp256k1 signature from Noble curves library
   * @return an array of felts, representing a Cairo Eth Signature.
   */
  protected formatEthSignature(fbSignature: FbSignature): ArraySignatureType {
    const r: Uint256 = uint256.bnToUint256(fbSignature.r);
    const s: Uint256 = uint256.bnToUint256(fbSignature.s);
    return [
      num.toHex(r.low),
      num.toHex(r.high),
      num.toHex(s.low),
      num.toHex(s.high),
      num.toHex(fbSignature.v),
    ] as ArraySignatureType;
  }

  protected async fbSign(msgHash: string): Promise<FbSignature> {
    console.log(msgHash);
    let paddedMsgHash = msgHash.slice(2).padStart(64, "0");
    console.log(paddedMsgHash);
    const { status, id } = await this.fireblocks.createTransaction({
      operation: TransactionOperation.RAW,
      // Should be same as asset in public key
      assetId: this.assetId,
      source: {
        type: PeerType.VAULT_ACCOUNT,
        id: this.vaultAccountId,
      },
      note: `TxHash: ${paddedMsgHash}`,
      extraParameters: {
        rawMessageData: {
          messages: [
            {
              content: paddedMsgHash,
              bip44addressIndex: this.bip44addressIndex,
            },
          ],
        },
      },
    });

    let txInfo;
    let currentStatus = status;
    while (currentStatus != TransactionStatus.COMPLETED && currentStatus != TransactionStatus.FAILED) {
      try {
        console.log("keep polling for tx " + id + "; status: " + currentStatus);
        txInfo = await this.fireblocks.getTransactionById(id);
        currentStatus = txInfo.status;
      } catch (err) {
        console.log("err", err);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log("Current Status", currentStatus);

    if (txInfo == undefined) {
      process.exit(0);
    }
    if (txInfo.signedMessages == undefined) {
      process.exit(0);
    }
    console.log("Signed Messages", txInfo.signedMessages);
    const signature = txInfo.signedMessages[0].signature;

    console.log(JSON.stringify(signature));

    if (signature.v == undefined) {
      process.exit(0);
    }

    const encodedSig = Buffer.from([signature.v + 31]).toString("hex") + signature.fullSig;
    let hexSig = Buffer.from(encodedSig, "hex").toString("base64");
    console.log("Encoded Signature:", hexSig);

    let sig = {
      r: `0x${signature.r}`,
      s: `0x${signature.s}`,
      v: signature.v,
    };
    return sig;
  }
}
