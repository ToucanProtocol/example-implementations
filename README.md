# Example Implementations

A collection of Solidity contract examples that implement, integrate with or demonstrate the use of Toucan's contracts and infrastructure. Some of these may be used in production.

## Contracts

| Contract     | Polygon                                                                                                                  | Mumbai                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| OffsetHelper | [0x7229F708d2d1C29b1508E35695a3070F55BbA479](https://polygonscan.com/address/0x7229F708d2d1C29b1508E35695a3070F55BbA479) | [0xE0a1D62C84f7Ca4611C0ada6cfC3E9187a7A97e6](https://mumbai.polygonscan.com/address/0xE0a1D62C84f7Ca4611C0ada6cfC3E9187a7A97e6) |

## OffsetHelper

The `OffsetHelper` contract implements helper functions that simplify the carbon offsetting (retirement) process.

See [./docs/OffsetHelper.md](./docs/OffsetHelper.md) for detailed documentation.

### Development

Install the requirements:
```
yarn install
```

Generate documentation from the contract's [natspec](https://docs.soliditylang.org/en/latest/natspec-format.html) comments in [./docs/](./docs/) using
```
npx hardhat docgen
```
