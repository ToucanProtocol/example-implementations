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

    // @description tells user how much of _fromToken is required to swap for an amount of pool tokens
    // @param _fromToken the token the user wants to swap for pool token
    // @param _toToken token to swap for (should be NCT or BCT)
    // @param _amount amount of NCT / BCT wanted
    // @returns uint256 representing the required ETH / MATIC to get the amount of NCT / BCT
    function calculateNeededTokenAmount(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) public view returns (uint256) {
        // check tokens
        require(
            isSwapable(_fromToken) && isRedeemable(_toToken),
            "Token not eligible"
        );

        // instantiate router
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // establish path
        address[] memory path = new address[](3);
        path[0] = _fromToken;
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;

        // get expected amountsIn
        uint256[] memory amountsIn = routerSushi.getAmountsIn(_amount, path);
        return amountsIn[0];
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
            "Token not eligible"
        );

        // instantiate router
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // establish path
        address[] memory path = new address[](3);
        path[0] = _fromToken;
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;

        // estimate amountsIn
        uint256[] memory expectedAmountsIn = routerSushi.getAmountsIn(
            _amount,
            path
        );

        // transfer tokens
        IERC20(_fromToken).safeTransferFrom(
            msg.sender,
            address(this),
            expectedAmountsIn[0]
        );

        // approve router
        IERC20(_fromToken).approve(sushiRouterAddress, expectedAmountsIn[0]);

        // swap
        routerSushi.swapTokensForExactTokens(
            _amount,
            expectedAmountsIn[2],
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

    // @description tells user how much ETH/MATIC is required to swap for an amount of pool tokens
    // @param _toToken token to swap for (should be NCT or BCT)
    // @param _amount amount of NCT / BCT wanted
    // @returns uint256 representing the required ETH / MATIC to get the amount of NCT / BCT
    function calculateNeededETHAmount(address _toToken, uint256 _amount)
        public
        view
        returns (uint256)
    {
        // check token
        require(isRedeemable(_toToken), "Token not eligible");

        // instantiate router
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // establish path
        address[] memory path = new address[](3);
        path[0] = eligibleTokenAddresses["WMATIC"];
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;

        // get expectedAmountsIn
        uint256[] memory amounts = routerSushi.getAmountsIn(_amount, path);
        return amounts[0];
    }

    // @description uses SushiSwap to exchange MATIC for BCT / NCT
    // @param _toToken token to swap for (will be held within contract)
    // @param _amount amount of NCT / BCT wanted
    // @notice needs to be provided a message value on client side
    function swap(address _toToken, uint256 _amount) public payable {
        // check tokens
        require(isRedeemable(_toToken), "Token not eligible");

        // instantiate router
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // estabilish path
        address[] memory path = new address[](3);
        path[0] = eligibleTokenAddresses["WMATIC"];
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;

        // estimate amountsIn
        uint256[] memory expectedAmountsIn = routerSushi.getAmountsIn(
            _amount,
            path
        );

        // check user sent enough ETH/MATIC
        require(msg.value >= expectedAmountsIn[0], "Didn't send enough MATIC");

        // swap
        uint256[] memory amountsIn = routerSushi.swapETHForExactTokens{
            value: msg.value
        }(_amount, path, address(this), block.timestamp);

        // send surplus back
        if (msg.value > amountsIn[0]) {
            uint256 leftoverETH = msg.value - amountsIn[0];
            (bool success, ) = msg.sender.call{value: leftoverETH}(
                new bytes(0)
            );

            require(success, "Failed to send surplus back");
        }

        // update balances
        balances[msg.sender][path[2]] += _amount;
    }

    // @description allow users to withdraw tokens they have deposited
    function withdraw(address _erc20Addr, uint256 _amount) public {
        require(
            balances[msg.sender][_erc20Addr] >= _amount,
            "Insufficient balance"
        );

        IERC20(_erc20Addr).safeTransfer(msg.sender, _amount);
        balances[msg.sender][_erc20Addr] -= _amount;
    }

    // @description allow people to deposit BCT / NCT
    // @notice needs to be approved
    function deposit(address _erc20Addr, uint256 _amount) public {
        require(isRedeemable(_erc20Addr), "Token not eligible");

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
        require(isRedeemable(_fromToken), "Token not eligible");

        require(
            balances[msg.sender][_fromToken] >= _amount,
            "Insufficient NCT/BCT balance"
        );

        // instantiate pool token (NCT or BCT)
        IToucanPoolToken PoolTokenImplementation = IToucanPoolToken(_fromToken);

        // auto redeem pool token for TCO2; will transfer automatically picked TCO2 to this contract
        (tco2s, amounts) = PoolTokenImplementation.redeemAuto2(_amount);

        // update balances
        balances[msg.sender][_fromToken] -= _amount;
        uint256 tco2sLen = tco2s.length;
        for (uint256 index = 0; index < tco2sLen; index++) {
            balances[msg.sender][tco2s[index]] += amounts[index];
        }

        emit Redeemed(msg.sender, _fromToken, tco2s, amounts);
    }

    // @param _tco2s the addresses of the TCO2s to retire
    // @param _amounts the amounts to retire from the matching TCO2
    function autoRetire(address[] memory _tco2s, uint256[] memory _amounts)
        public
    {
        uint256 tco2sLen = _tco2s.length;
        require(tco2sLen != 0, "Array empty");

        require(tco2sLen == _amounts.length, "Arrays unequal");

        uint256 i = 0;
        while (i < tco2sLen) {
            require(
                balances[msg.sender][_tco2s[i]] >= _amounts[i],
                "Insufficient TCO2 balance"
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
