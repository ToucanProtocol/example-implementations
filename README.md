# Example Implementations

A hardhat repo that is a collection of Solidity contract **examples** that integrate with or demonstrate the use of Toucan's contracts and infrastructure. Some of these may be used in production and we'll provide links to their prod repos below.

## OffsetHelper

The `OffsetHelper` contract implements helper functions that simplify the carbon offsetting (retirement) process. It's production version (with actualized related documentation) which is actively maintained can be found [here](https://github.com/ToucanProtocol/OffsetHelper). You can still use the version found in this repo as an example for inspiration purposes.

### Development

## Preqrequisites

1. Install the required packages:
   ```
   yarn
   ```
2. Copy `.env.example` to `.env` and modify values of the required environment variables:
   1. `POLYGON_URL`/`MUMBAI_URL` to specify custom RPC endpoints for Polygon Mainnet, respectively, the Mumbai Testnet.
   2. `PRIVATE_KEY` and `POLYGONSCAN_KEY` in order to deploy contract and publish source code on [polygonscan](https://polygonscan.com).

## Commands

Use the following commands to compile, test and deploy the contracts:

```
yarn compile
yarn test      # test using a polygon fork
yarn coverage  # test using a polygon fork with coverage report
yarn deploy
```

Documentation can be auto-generated from the contract's [natspec](https://docs.soliditylang.org/en/latest/natspec-format.html) in [./docs/](./docs/) using

```
yarn doc
```

Deploy the contract locally with:

```
yarn hardhat --network hardhat deployOffsetHelper --verify false
```
