# Basic Starknet-JS wallet

This is a basic tool to run basic commands on a Starknet contract, from a terminal.
The tool supports:

- Deterministic address derivation for Starknet contract given a seed phrase and class hash
- Generate a new seed and deploy a contract to a predefined address
- At default works with the latest trialed-and-tested OpenZeppelin contract

## Installation

```shell
yarn install
```

## Supported features

- generate seed
- print address
- deploy account at address
- get balance
- transfer (ETH by default)
- declare contract
- declare cairo 1 contract
- deploy contract via Universal Deployer Contract ([UDC](https://docs.starknet.io/documentation/architecture_and_concepts/Smart_Contracts/universal-deployer/))
- invoke contract
- call contract

## Fireblocks wallet

- To run with Fireblocks wallet, use `ts-node ./src/fb-wallet.ts`
  See the example `.env-fb.example` file for Fireblocks to work

### Steps for interacting with the Fireblocks Wallet

This Fireblocks PoC is configured to work with Starknet Seoplia, and using the Fireblocks Developer Sandbox.
It uses the latest version of the OpenZeppelin Ethereum contract (already declared on Sepolia and Mainnet).

The main logic can be found in `./src/FbSigner.ts` which implements the `Signer` interface of [Starknet.js](https://www.starknetjs.com/).

- `FbSigner.ts`: Implementation of the Signer interface
- `FbWallet.ts`: A wallet implementation, nicely wrapping starknet.js calls to make transfers, declaring and deploying contracts etc.
- `fb-wallet.ts`: A CLI for interacting with `FbWallet.ts` accepting CLI parameters

1. You will need a Fireblocks API key and a secret file. Follow this [guide](https://developers.fireblocks.com/docs/sandbox-quickstart) for setting up an API user in the sandbox.
2. Once the file and the API keys are obtained, put the key and path in the `.env` file as shown in the `.env-fb.example` file.
3. Generate a new Ethereum vault in the Fireblocks console, using ETH Sepolia as the asset.
4. You will need to obtain the uncompressed Ethereum Public Key of the vault to sign transactions. Go to `4.1` to get the vaults and their IDs.

   4.1. Run the script `ts-node ./src/fb-first.ts` to get all vaults and their IDs;

   4.2. Run the script `ts-node ./src/fb-pk.ts` to get public keys of a valut. Update the script with the vault ID and asset. For example, if this is the first vault created for Ethereum Sepolia, the `vaultAccountId` is 1, and the `assetId` is `ETH_TEST5`. These values will be different for mainnet.

5. Paste the public key into the `.env` file in the relevant field
6. To deploy a new account, run the command `ts-node ./src/fb-wallet.ts deploy_account`

   6.1. At first the command will fail, as there are no funds in the account. The script will print out the future account address.

   6.2. Fund the address with ETH from a Sepolia Faucet. You can use one of the following faucets:

   - Blast API - https://blastapi.io/faucets/starknet-sepolia-eth
   - Starknet Foundation - https://starknet-faucet.vercel.app/

   6.3. Now with the account funded, run the script again. The account should be deployed onchain.

7. Try to make a simple transfer from the account by running `ts-node ./src/fb-wallet.ts transfer 0x01 0.0000001`

Successful output should look like this:

```shell
> ts-node ./src/fb-wallet.ts transfer 0x01 0.000001
Transfering 0.000001 tokens 0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7 to 0x01
Overall Fee: 0.00135043911032317
Gas Consumed: 2770
Gas Price: 487.523144521
Suggested Max Fee: 0.002025658665484755
0x4469e56d2fd37609723f40f15fbd64bc73d2ebdb2878767044495fd191378dc
04469e56d2fd37609723f40f15fbd64bc73d2ebdb2878767044495fd191378dc
keep polling for tx 76f4217b-48a1-47f7-af86-a76e0bd83e95; status: SUBMITTED
keep polling for tx 76f4217b-48a1-47f7-af86-a76e0bd83e95; status: SUBMITTED
keep polling for tx 76f4217b-48a1-47f7-af86-a76e0bd83e95; status: PENDING_SIGNATURE
keep polling for tx 76f4217b-48a1-47f7-af86-a76e0bd83e95; status: PENDING_SIGNATURE
Current Status COMPLETED
Signed Messages [
  {
    derivationPath: [ 44, 1, 1, 0, 0 ],
    algorithm: 'MPC_ECDSA_SECP256K1',
    publicKey: '02255bbfdd5517a479590babf52a27dd2d7075cacfa327cde1d08b46a5067ebb11',
    signature: {
      fullSig: '901044b6d86865ac39b1ee74c6a3f21657e62225a410035ebe9b1eed4551527f194b210f26a8c283f8cb19f613c0a3c6af511404ab16b7cd90981e4414f11374',
      r: '901044b6d86865ac39b1ee74c6a3f21657e62225a410035ebe9b1eed4551527f',
      s: '194b210f26a8c283f8cb19f613c0a3c6af511404ab16b7cd90981e4414f11374',
      v: 1
    },
    content: '04469e56d2fd37609723f40f15fbd64bc73d2ebdb2878767044495fd191378dc'
  }
]
{"fullSig":"901044b6d86865ac39b1ee74c6a3f21657e62225a410035ebe9b1eed4551527f194b210f26a8c283f8cb19f613c0a3c6af511404ab16b7cd90981e4414f11374","r":"901044b6d86865ac39b1ee74c6a3f21657e62225a410035ebe9b1eed4551527f","s":"194b210f26a8c283f8cb19f613c0a3c6af511404ab16b7cd90981e4414f11374","v":1}
Encoded Signature: IJAQRLbYaGWsObHudMaj8hZX5iIlpBADXr6bHu1FUVJ/GUshDyaowoP4yxn2E8Cjxq9RFASrFrfNkJgeRBTxE3Q=
Awaiting tx  0x4469e56d2fd37609723f40f15fbd64bc73d2ebdb2878767044495fd191378dc
Tx mined  0x4469e56d2fd37609723f40f15fbd64bc73d2ebdb2878767044495fd191378dc
```

## Ethereum wallet

- To run with Ethereum wallet, use `ts-node ./src/eth-wallet.ts`
  See the example `.env-eth.example` file for Ethereum to work

## Testing

To run the integrations test with `starknet-devent`, run `starknet-devnet --seed 0` in another terminal.
Use `starknet-devnet>=0.5.3`

```shell
yarn test
```

More testing is required

Copy the resulting seed, public key and address to an `.env` file

## .env file

See example `.env` file for how to configure the wallet

## Fee Token Addresses

The fee token accorss all networks is ETH `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7`

# Contributors ✨

This POC implementation has been created by:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="100%"><a href="https://github.com/amanusk"><img src="https://avatars.githubusercontent.com/u/7280933?v=4?s=100" width="100px;" alt="amanusk"/><br /><sub><b>amanusk </b></sub></a><br /></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
