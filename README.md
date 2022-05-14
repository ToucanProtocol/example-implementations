# Example Implementations

A collection of examples that implement, integrate with or otherwise use Toucan's contracts and infrastructure. Some of these may be used in production.

## OffsetHelper

The `OffsetHelper` abstracts the carbon offsetting process offered by Toucan to make it easier. Instead of you manually swapping your USDC for NCT, redeeming the NCT for TCO2, then retiring the TCO2... you can just use the `OffsetHelper` to swiftly do this process in 1-2 transactions.

You can find the `OffsetHelper` deployed [here on Polygon mainnet](https://polygonscan.com/address/0xb334795bf50e4943d076Dfb38D8C1A50F9F5a101) and [here on Mumbai](https://mumbai.polygonscan.com/address/0x3E0E589cBd008024Cd272418Ea44Dfc4940650d3), but you are free to deploy your own or even import this contract in your own to extend it.

This contract has 2 main methods that users would interact with: `autoOffset` and `autoOffsetUsingPoolToken`.

### `autoOffset(address _depositedToken, address _poolToken_, uint256 _amountToOffset)`

This method takes your tokens, swaps them for pool tokens (BCT or NCT), redeems that for the lowest quality TCO2 and then retires it.

Let's discuss the params: the first is the token you will deposit to do the offset (could be USDC, WETH or WMATIC), the second is the pool token you want the contract to use (could be NCT or BCT) and the last is the amount of TCO2 to retire.

You will have to approve the `OffsetHelper` from the token you wish to deposit before calling `autoOffset()` in this case.

### `autoOffset(address _poolToken_, uint256 _amountToOffset)`

If you call the `autoOffset()` method specifying only 2 params, it will be payable and you will need to specify a `msg.value`. It works the same as the above method, only this one will swap MATIC for pool tokens instead.

The first param is the pool token you want the contract to use (could be NCT or BCT) and the second is the amount of TCO2 to retire.

In case you send too much MATIC in the `msg.value`, the contract is programed to send leftover MATIC back to the user. But, I suggest you use the `howMuchETHShouldISendToSwap()` method of the contract before calling `autoOffset()` in this case.

We'll discuss the `howMuchETHShouldISendToSwap()` method below.

### `autoOffsetUsingPoolToken(address _poolToken, uint256 _amountToOffset)`

This method is made for users that already have a pool token in their wallet (BCT or NCT), but still would like to use the `OffsetHelper` to abstract away a few steps.

It takes your pool token, redeems it for the lowest quality TCO2 and retires it.

The first parameter is the pool token you will deposit to do the offset (could be NCT or BCT), the second is the amount of TCO2 to retire.

You will want to approve the `OffsetHelper` from the token you wish to deposit before calling `autoOffsetUsingPoolToken()` in this case.

### `howMuchETHShouldISendToSwap(address _toToken, uint256 _amount)`

This is a view method that allows you to see how much MATIC it would cost you to get a certain amount of BCT / NCT.

Since (when automatically redeeming pool tokens for the lowest quality TCO2s) the redeeming has no fees and you get 1 TCO2 for each pool token you redeem, effectively this method will tell you how much MATIC you have to deposit to be able to retired a specific amount of TCO2.

Normally, you'd use it before calling `autoOffset(address _poolToken_, uint256 _amountToOffset)` and the result it returns will be assigned as msg.value when you call `autoOffset(address _poolToken_, uint256 _amountToOffset)`.

### Others

There are other methods you can interact with, but you probably won't because it would result in a fairly manual, multi-step offsetting process which is what we're trying to abstract.

You can find the `OffsetHelper` deployed [here on Polygon mainnet](https://polygonscan.com/address/0x79E63048B355F4FBa192c5b28687B852a5521b31) and [here on Mumbai](https://mumbai.polygonscan.com/address/0x1A38e74D5190bA69938979aBe69ceb7b823209d3), but you are free to deploy your own or even import this contract in your own to extend it.
