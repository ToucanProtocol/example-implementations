# Example Implementations

A collection of Solidity contract examples that implement, integrate with or demonstrate the use of Toucan's contracts and infrastructure. Some of these may be used in production.

## Contracts

| Contract     | Polygon                                                                                                                  | Mumbai                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| OffsetHelper | [0x7229F708d2d1C29b1508E35695a3070F55BbA479](https://polygonscan.com/address/0x7229F708d2d1C29b1508E35695a3070F55BbA479) | [0xE0a1D62C84f7Ca4611C0ada6cfC3E9187a7A97e6](https://mumbai.polygonscan.com/address/0xE0a1D62C84f7Ca4611C0ada6cfC3E9187a7A97e6) |

## OffsetHelper

The `OffsetHelper` contract implements helper functions that simplify the carbon offsetting (retirement) process. Retiring carbon tokens normally requires multiple steps and interactions with Toucan Protocol's main contracts:
1. Obtain a Toucan pool token such as BCT or NCT (by performing a token swap).
2. Redeem the pool token for a TCO2 token.
3. Retire the TCO2 token.

These steps are combined in each of the following "auto offset" methods implemented in `OffsetHelper` to allow a retirement within one transaction:
- `autoOffsetUsingPoolToken()` if the user has already owns a Toucan pool token such as BCT or NCT,
- `autoOffsetUsingETH()` if the user would like to perform a retirement using MATIC,
- `autoOffsetUsingToken()` if the user would like to perform a retirement using an ERC20 token: USDC, WETH or WMATIC.

In these methods, "auto" refers to the fact that these methods use `autoRedeem` in order to automatically choose a TCO2 token corresponding to the oldest tokenized carbon project in the specfified token pool. There are no fees incurred by the user when using `autoRedeem`.

There are two read helper functions `calculateNeededETHAmount()` and `calculateNeededTokenAmount()` that can be used before calling `autoOffsetUsingETH()` and `autoOffsetUsingToken()`, to determine how MATIC, respectively how much of the ERC20 token must be sent to the `OffsetHelper` contract in order to retire the specified amount of carbon. 

See [./docs/OffsetHelper.md](./docs/OffsetHelper.md) for detailed documentation of these and other methods from the contract.

### Development

Install the requirements:
```
yarn install
```

Generate the documentation using
```
npx hardhat docgen
```
