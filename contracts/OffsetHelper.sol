//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./OffsetHelperStorage.sol";
import "./interfaces/IToucanPoolToken.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IToucanCarbonOffsets.sol";
import "./interfaces/IToucanContractRegistry.sol";
import "hardhat/console.sol";

contract OffsetHelper is OffsetHelperStorage {
    using SafeERC20 for IERC20;

    constructor(
        string[] memory _eligibleTokenSymbols,
        address[] memory _eligibleTokenAddresses
    ) {
        uint256 i = 0;
        uint256 eligibleTokenSymbolsLen = _eligibleTokenSymbols.length;
        while (i < eligibleTokenSymbolsLen) {
            eligibleTokenAddresses[
                _eligibleTokenSymbols[i]
            ] = _eligibleTokenAddresses[i];
            i += 1;
        }
    }

    event Redeemed(
        address who,
        address poolToken,
        address[] tco2s,
        uint256[] amounts
    );

    // @description this is the autoOffset method for when the user wants to input tokens like USDC, WETH, WMATIC
    // @param _depositedToken the address of the token that the user sends (could be USDC, WETH, WMATIC)
    // @param _poolToken the pool that the user wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    // @returns 2 arrays, one containing the tco2s that were redeemed and another the amounts
    function autoOffsetUsingToken(
        address _depositedToken,
        address _poolToken,
        uint256 _amountToOffset
    ) public returns (address[] memory tco2s, uint256[] memory amounts) {
        // swap input token for BCT / NCT
        swap(_depositedToken, _poolToken, _amountToOffset);

        // redeem BCT / NCT for TCO2s
        (tco2s, amounts) = autoRedeem(_poolToken, _amountToOffset);

        // retire the TCO2s to achieve offset
        autoRetire(tco2s, amounts);
    }

    // @description this is the autoOffset method for when the user wants to input MATIC
    // @param _poolToken the pool that the user wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    function autoOffsetUsingETH(address _poolToken, uint256 _amountToOffset)
        public
        payable
        returns (address[] memory tco2s, uint256[] memory amounts)
    {
        // swap MATIC for BCT / NCT
        swap(_poolToken, _amountToOffset);

        // redeem BCT / NCT for TCO2s
        (tco2s, amounts) = autoRedeem(_poolToken, _amountToOffset);

        // retire the TCO2s to achieve offset
        autoRetire(tco2s, amounts);
    }

    // @description this is the autoOffset method for when the user already has and wants to input BCT / NCT
    // @param _poolToken the pool token that the user wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    function autoOffsetUsingPoolToken(
        address _poolToken,
        uint256 _amountToOffset
    ) public returns (address[] memory tco2s, uint256[] memory amounts) {
        // deposit pool token from user to this contract
        deposit(_poolToken, _amountToOffset);

        // redeem BCT / NCT for TCO2s
        (tco2s, amounts) = autoRedeem(_poolToken, _amountToOffset);

        // retire the TCO2s to achieve offset
        autoRetire(tco2s, amounts);
    }

    // checks address and returns if can be used at all by the contract
    // @param _erc20Address address of token to be checked
    function isEligible(address _erc20Address) private view returns (bool) {
        bool isToucanContract = IToucanContractRegistry(contractRegistryAddress)
            .checkERC20(_erc20Address);
        if (isToucanContract) return true;
        if (_erc20Address == eligibleTokenAddresses["BCT"]) return true;
        if (_erc20Address == eligibleTokenAddresses["NCT"]) return true;
        if (_erc20Address == eligibleTokenAddresses["USDC"]) return true;
        if (_erc20Address == eligibleTokenAddresses["WETH"]) return true;
        if (_erc20Address == eligibleTokenAddresses["WMATIC"]) return true;
        return false;
    }

    // checks address and returns if it can be used in a swap
    // @param _erc20Address address of token to be checked
    function isSwapable(address _erc20Address) private view returns (bool) {
        if (_erc20Address == eligibleTokenAddresses["USDC"]) return true;
        if (_erc20Address == eligibleTokenAddresses["WETH"]) return true;
        if (_erc20Address == eligibleTokenAddresses["WMATIC"]) return true;
        return false;
    }

    // checks address and returns if can it's a pool token and can be redeemed
    // @param _erc20Address address of token to be checked
    function isRedeemable(address _erc20Address) private view returns (bool) {
        if (_erc20Address == eligibleTokenAddresses["BCT"]) return true;
        if (_erc20Address == eligibleTokenAddresses["NCT"]) return true;
        return false;
    }

    // @description uses SushiSwap to exchange eligible tokens for BCT / NCT
    // @param _fromToken token to deposit and swap
    // @param _toToken token to swap for (will be held within contract)
    // @param _amount amount of NCT / BCT wanted
    // @notice needs to be approved on the client side
    function swap(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) public {
        // check tokens
        require(
            isSwapable(_fromToken) && isRedeemable(_toToken),
            "Can't swap this token"
        );

        // transfer token from user to this contract
        IERC20(_fromToken).safeTransferFrom(msg.sender, address(this), _amount);

        // approve sushi router
        IERC20(_fromToken).approve(sushiRouterAddress, _amount);

        // instantiate sushi router
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // establish path (in most cases token -> USDC -> NCT/BCT should work)
        address[] memory path = new address[](3);
        path[0] = _fromToken;
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;

        // swap input token for pool token
        uint256[] memory amountsIn = routerSushi.getAmountsIn(_amount, path);
        routerSushi.swapTokensForExactTokens(
            _amount,
            amountsIn[2],
            path,
            address(this),
            block.timestamp
        );

        // update balances
        balances[msg.sender][path[2]] += _amount;
    }

    // apparently I need a fallback and a receive method to fix the situation where transfering dust MATIC
    // in the MATIC to token swap fails
    fallback() external payable {}

    receive() external payable {}

    // @description tells user how much ETH/MATIC is required to swap for an amount of specified tokens
    // @param _toToken token to swap for (should be NCT or BCT)
    // @param _amount amount of NCT / BCT wanted
    // @returns uint256 representing the required ETH / MATIC to get the amount of NCT / BCT
    function howMuchETHShouldISendToSwap(address _toToken, uint256 _amount)
        public
        view
        returns (uint256)
    {
        // require token to be redeemable
        require(isRedeemable(_toToken), "Can't swap for this token");

        // instantiate sushi router
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // establish path;
        // sushi router expects path[0] == WMATIC, but otherwise the path will resemble the one above
        address[] memory path = new address[](3);
        path[0] = eligibleTokenAddresses["WMATIC"];
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;

        // get and return the amount needed to send to get the mentioned tokens
        uint256[] memory amounts = routerSushi.getAmountsIn(_amount, path);
        return amounts[0];
    }

    // @description uses SushiSwap to exchange MATIC for BCT / NCT
    // @param _toToken token to swap for (will be held within contract)
    // @param _amount amount of NCT / BCT wanted
    // @notice needs to be provided a message value on client side
    function swap(address _toToken, uint256 _amount) public payable {
        // check eligibility of token to swap for
        require(isRedeemable(_toToken), "Can't swap for this token");

        // instantiate sushi
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // sushi router expects path[0] == WMATIC, but otherwise the path will resemble the one above
        address[] memory path = new address[](3);
        path[0] = eligibleTokenAddresses["WMATIC"];
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;

        // swap MATIC for tokens
        uint256[] memory amounts = routerSushi.swapETHForExactTokens{
            value: msg.value
        }(_amount, path, address(this), block.timestamp);

        if (msg.value > amounts[0]) {
            uint256 leftoverETH = msg.value - amounts[0];
            (bool success, ) = msg.sender.call{value: leftoverETH}(
                new bytes(0)
            );
            require(success, "Failed to send dust ETH back to user.");
        }

        // update balances
        balances[msg.sender][path[2]] += _amount;
    }

    // @description allow users to withdraw tokens they have deposited
    function withdraw(address _erc20Addr, uint256 _amount) public {
        require(
            balances[msg.sender][_erc20Addr] >= _amount,
            "You don't have enough to withdraw."
        );

        IERC20(_erc20Addr).transfer(msg.sender, _amount);
        balances[msg.sender][_erc20Addr] -= _amount;
    }

    // @description allow people to deposit BCT / NCT
    // @notice needs to be approved
    function deposit(address _erc20Addr, uint256 _amount) public {
        require(isRedeemable(_erc20Addr), "Can't deposit this token");

        IERC20(_erc20Addr).safeTransferFrom(msg.sender, address(this), _amount);
        balances[msg.sender][_erc20Addr] += _amount;
    }

    // @description redeems an amount of NCT / BCT for TCO2
    // @param _fromToken could be the address of NCT or BCT
    // @param _amount amount to redeem
    // @notice needs to be approved on the client side
    // @returns 2 arrays, one containing the tco2s that were redeemed and another the amounts
    function autoRedeem(address _fromToken, uint256 _amount)
        public
        returns (address[] memory tco2s, uint256[] memory amounts)
    {
        require(isRedeemable(_fromToken), "Can't redeem this token.");

        require(
            balances[msg.sender][_fromToken] >= _amount,
            "You haven't deposited enough NCT / BCT"
        );

        // instantiate pool token (NCT or BCT)
        IToucanPoolToken PoolTokenImplementation = IToucanPoolToken(_fromToken);

        // auto redeem pool token for TCO2; will transfer automatically picked TCO2 to this contract
        (tco2s, amounts) = PoolTokenImplementation.redeemAuto2(_amount);

        // update balances
        balances[msg.sender][_fromToken] -= _amount;
        for (uint256 index = 0; index < tco2s.length; index++) {
            balances[msg.sender][tco2s[index]] += amounts[index];
        }

        emit Redeemed(msg.sender, _fromToken, tco2s, amounts);
    }

    // @param _tco2s the addresses of the TCO2s to retire
    // @param _amounts the amounts to retire from the matching TCO2
    function autoRetire(address[] memory _tco2s, uint256[] memory _amounts)
        public
    {
        require(_tco2s.length > 0, "You need to have at least one TCO2.");

        require(
            _tco2s.length == _amounts.length,
            "You need an equal number of addresses and amounts"
        );

        uint256 i = 0;
        while (i < _tco2s.length) {
            if (_amounts[i] < 1e15) continue;
            require(
                balances[msg.sender][_tco2s[i]] >= _amounts[i],
                "You don't have enough of this TCO2"
            );

            balances[msg.sender][_tco2s[i]] -= _amounts[i];

            IToucanCarbonOffsets(_tco2s[i]).retire(_amounts[i]);

            unchecked {
                ++i;
            }
        }
    }

    // ----------------------------------------
    //  Admin methods
    // ----------------------------------------

    // @description you can use this to change or add eligible tokens and their addresses if needed
    // @param _tokenSymbol symbol of the token to add
    // @param _address the address of the token to add
    function setEligibleTokenAddress(
        string memory _tokenSymbol,
        address _address
    ) public virtual onlyOwner {
        eligibleTokenAddresses[_tokenSymbol] = _address;
    }

    // @description you can use this to delete eligible tokens  if needed
    // @param _tokenSymbol symbol of the token to add
    function deleteEligibleTokenAddress(string memory _tokenSymbol)
        public
        virtual
        onlyOwner
    {
        delete eligibleTokenAddresses[_tokenSymbol];
    }

    // @description you can use this to change the TCO2 contracts registry if needed
    // @param _address the contract registry to use
    function setToucanContractRegistry(address _address)
        public
        virtual
        onlyOwner
    {
        contractRegistryAddress = _address;
    }
}
