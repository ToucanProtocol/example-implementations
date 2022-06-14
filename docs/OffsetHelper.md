# Solidity API

## OffsetHelper

Helper functions that simplify the carbon offsetting (retirement)
process.

Retiring carbon tokens requires multiple steps and interactions with
Toucan Protocol's main contracts:
1. Obtain a Toucan pool token such as BCT or NCT (by performing a token
   swap).
2. Redeem the pool token for a TCO2 token.
3. Retire the TCO2 token.

These steps are combined in each of the following "auto offset" methods
implemented in `OffsetHelper` to allow a retirement within one transaction:
- `autoOffsetUsingPoolToken()` if the user already owns a Toucan pool
  token such as BCT or NCT,
- `autoOffsetUsingETH()` if the user would like to perform a retirement
  using MATIC,
- `autoOffsetUsingToken()` if the user would like to perform a retirement
  using an ERC20 token: USDC, WETH or WMATIC.

In these methods, "auto" refers to the fact that these methods use
`autoRedeem()` in order to automatically choose a TCO2 token corresponding
to the oldest tokenized carbon project in the specfified token pool.
There are no fees incurred by the user when using `autoRedeem()`, i.e., the
user receives 1 TCO2 token for each pool token (BCT/NCT) redeemed.

There are two `view` helper functions `calculateNeededETHAmount()` and
`calculateNeededTokenAmount()` that should be called before using
`autoOffsetUsingETH()` and `autoOffsetUsingToken()`, to determine how much
 MATIC, respectively how much of the ERC20 token must be sent to the
`OffsetHelper` contract in order to retire the specified amount of carbon.

### constructor

```solidity
constructor(string[] _eligibleTokenSymbols, address[] _eligibleTokenAddresses) public
```

Contract constructor. Should specify arrays of ERC20 symbols and
addresses that can used by the contract.

_See `isEligible()` for a list of tokens that can be used in the
contract. These can be modified after deployment by the contract owner
using `setEligibleTokenAddress()` and `deleteEligibleTokenAddress()`._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eligibleTokenSymbols | string[] | A list of token symbols. |
| _eligibleTokenAddresses | address[] | A list of token addresses corresponding to the provided token symbols. |

### Redeemed

```solidity
event Redeemed(address who, address poolToken, address[] tco2s, uint256[] amounts)
```

Emitted upon successful redemption of TCO2 tokens from a Toucan
pool token such as BCT or NCT.

| Name | Type | Description |
| ---- | ---- | ----------- |
| who | address | The sender of the transaction |
| poolToken | address | The address of the Toucan pool token used in the redemption, for example, NCT or BCT |
| tco2s | address[] | An array of the TCO2 addresses that were redeemed |
| amounts | uint256[] | An array of the amounts of each TCO2 that were redeemed |

### autoOffsetUsingToken

```solidity
function autoOffsetUsingToken(address _depositedToken, address _poolToken, uint256 _amountToOffset) public returns (address[] tco2s, uint256[] amounts)
```

Retire carbon credits using the lowest quality (oldest) TCO2
tokens available from the specified Toucan token pool by sending ERC20
tokens (USDC, WETH, WMATIC). Use `calculateNeededTokenAmount` first in
order to find out how much of the ERC20 token is required to retire the
specified quantity of TCO2.

This function:
1. Swaps the ERC20 token sent to the contract for the specified pool token.
2. Redeems the pool token for the poorest quality TCO2 tokens available.
3. Retires the TCO2 tokens.

Note: The client must approve the ERC20 token that is sent to the contract.

_When automatically redeeming pool tokens for the lowest quality
TCO2s there are no fees and you receive exactly 1 TCO2 token for 1 pool
token._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _depositedToken | address | The address of the ERC20 token that the user sends (must be one of USDC, WETH, WMATIC) |
| _poolToken | address | The address of the Toucan pool token that the user wants to use, for example, NCT or BCT |
| _amountToOffset | uint256 | The amount of TCO2 to offset |

| Name | Type | Description |
| ---- | ---- | ----------- |
| tco2s | address[] | An array of the TCO2 addresses that were redeemed |
| amounts | uint256[] | An array of the amounts of each TCO2 that were redeemed |

### autoOffsetUsingETH

```solidity
function autoOffsetUsingETH(address _poolToken, uint256 _amountToOffset) public payable returns (address[] tco2s, uint256[] amounts)
```

Retire carbon credits using the lowest quality (oldest) TCO2
tokens available from the specified Toucan token pool by sending MATIC.
Use `calculateNeededETHAmount()` first in order to find out how much
MATIC is required to retire the specified quantity of TCO2.

This function:
1. Swaps the Matic sent to the contract for the specified pool token.
2. Redeems the pool token for the poorest quality TCO2 tokens available.
3. Retires the TCO2 tokens.

_If the user sends much MATIC, the leftover amount will be sent back
to the user._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _poolToken | address | The address of the Toucan pool token that the user wants to use, for example, NCT or BCT. |
| _amountToOffset | uint256 | The amount of TCO2 to offset. |

| Name | Type | Description |
| ---- | ---- | ----------- |
| tco2s | address[] | An array of the TCO2 addresses that were redeemed |
| amounts | uint256[] | An array of the amounts of each TCO2 that were redeemed |

### autoOffsetUsingPoolToken

```solidity
function autoOffsetUsingPoolToken(address _poolToken, uint256 _amountToOffset) public returns (address[] tco2s, uint256[] amounts)
```

Retire carbon credits using the lowest quality (oldest) TCO2
tokens available by sending Toucan pool tokens, for example, BCT or NCT.

This function:
1. Redeems the pool token for the poorest quality TCO2 tokens available.
2. Retires the TCO2 tokens.

Note: The client must approve the pool token that is sent.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _poolToken | address | The address of the Toucan pool token that the user wants to use, for example, NCT or BCT. |
| _amountToOffset | uint256 | The amount of TCO2 to offset. |

| Name | Type | Description |
| ---- | ---- | ----------- |
| tco2s | address[] | An array of the TCO2 addresses that were redeemed |
| amounts | uint256[] | An array of the amounts of each TCO2 that were redeemed |

### isEligible

```solidity
function isEligible(address _erc20Address) private view returns (bool)
```

Checks whether an address can be used by the contract.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _erc20Address | address | address of the ERC20 token to be checked |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the address can be used by the contract |

### isSwapable

```solidity
function isSwapable(address _erc20Address) private view returns (bool)
```

Checks whether an address can be used in a token swap

| Name | Type | Description |
| ---- | ---- | ----------- |
| _erc20Address | address | address of token to be checked |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the specified address can be used in a swap |

### isRedeemable

```solidity
function isRedeemable(address _erc20Address) private view returns (bool)
```

Checks whether an address is a Toucan pool token address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _erc20Address | address | address of token to be checked |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the address is a Toucan pool token address |

### calculateNeededTokenAmount

```solidity
function calculateNeededTokenAmount(address _fromToken, address _toToken, uint256 _amount) public view returns (uint256)
```

Return how much of the specified ERC20 token is required in
order to swap for the desired amount of a Toucan pool token, for
example, BCT or NCT.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fromToken | address | The address of the ERC20 token used for the swap |
| _toToken | address | The address of the pool token to swap for, for example, NCT or BCT |
| _amount | uint256 | The desired amount of pool token to receive |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amountsIn The amount of the ERC20 token required in order to swap for the specified amount of the pool token |

### swap

```solidity
function swap(address _fromToken, address _toToken, uint256 _amount) public
```

Swap eligible ERC20 tokens for Toucan pool tokens (BCT/NCT) on SushiSwap

_Needs to be approved on the client side_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fromToken | address | The ERC20 oken to deposit and swap |
| _toToken | address | The token to swap for (will be held within contract) |
| _amount | uint256 | The required amount of the Toucan pool token (NCT/BCT) |

### fallback

```solidity
fallback() external payable
```

### receive

```solidity
receive() external payable
```

### calculateNeededETHAmount

```solidity
function calculateNeededETHAmount(address _toToken, uint256 _amount) public view returns (uint256)
```

Return how much MATIC is required in order to swap for the
desired amount of a Toucan pool token, for example, BCT or NCT.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _toToken | address | The address of the pool token to swap for, for example, NCT or BCT |
| _amount | uint256 | The desired amount of pool token to receive |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amounts The amount of MATIC required in order to swap for the specified amount of the pool token |

### swap

```solidity
function swap(address _toToken, uint256 _amount) public payable
```

Swap MATIC for Toucan pool tokens (BCT/NCT) on SushiSwap

| Name | Type | Description |
| ---- | ---- | ----------- |
| _toToken | address | Token to swap for (will be held within contract) |
| _amount | uint256 | Amount of NCT / BCT wanted |

### withdraw

```solidity
function withdraw(address _erc20Addr, uint256 _amount) public
```

Allow users to withdraw tokens they have deposited.

### deposit

```solidity
function deposit(address _erc20Addr, uint256 _amount) public
```

Allow users to deposit BCT / NCT.

_Needs to be approved_

### autoRedeem

```solidity
function autoRedeem(address _fromToken, uint256 _amount) public returns (address[] tco2s, uint256[] amounts)
```

Redeems the specified amount of NCT / BCT for TCO2.

_Needs to be approved on the client side_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fromToken | address | Could be the address of NCT or BCT |
| _amount | uint256 | Amount to redeem |

| Name | Type | Description |
| ---- | ---- | ----------- |
| tco2s | address[] | An array of the TCO2 addresses that were redeemed |
| amounts | uint256[] | An array of the amounts of each TCO2 that were redeemed |

### autoRetire

```solidity
function autoRetire(address[] _tco2s, uint256[] _amounts) public
```

Retire the specified TCO2 tokens.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _tco2s | address[] | The addresses of the TCO2s to retire |
| _amounts | uint256[] | The amounts to retire from each of the corresponding TCO2 addresses |

### setEligibleTokenAddress

```solidity
function setEligibleTokenAddress(string _tokenSymbol, address _address) public virtual
```

Change or add eligible tokens and their addresses.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _tokenSymbol | string | The symbol of the token to add |
| _address | address | The address of the token to add |

### deleteEligibleTokenAddress

```solidity
function deleteEligibleTokenAddress(string _tokenSymbol) public virtual
```

Delete eligible tokens stored in the contract.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _tokenSymbol | string | The symbol of the token to remove |

### setToucanContractRegistry

```solidity
function setToucanContractRegistry(address _address) public virtual
```

Change the TCO2 contracts registry.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _address | address | The address of the Toucan contract registry to use |

