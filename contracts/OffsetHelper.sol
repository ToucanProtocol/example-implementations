//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CO2KEN_contracts/ToucanCarbonOffsets.sol";
import "./CO2KEN_contracts/pools/BaseCarbonTonne.sol";
import "./CO2KEN_contracts/pools/NCT.sol";
import "./OffsetHelperStorage.sol";
import "./uniswapv2/IUniswapV2Router02.sol";

contract OffsetHelper is OffsetHelperStorage {
    using SafeERC20 for IERC20;

    // @param _depositedToken the token the user sends (could be USDC, WETH, WMATIC)
    // @param _carbonToken the redeem token that the user wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    function autoOffset(
        address _depositedToken,
        address _carbonToken,
        uint256 _amountToOffset
    ) public {}

    // @param _carbonToken the redeem token that the user wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    function autoOffset(address _carbonToken, uint256 _amountToOffset)
        public
        payable
    {}

    // @param _depositedToken the redeem token that the user deposited & wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    function autoOffsetUsingRedeemableToken(
        address _depositedToken,
        uint256 _amountToOffset
    ) public {}

    // checks address and returns if can be used at all by contract
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

    // checks address and returns if can be used in a swap
    // @param _erc20Address address of token to be checked
    function isSwapable(address _erc20Address) private view returns (bool) {
        if (_erc20Address == eligibleTokenAddresses["USDC"]) return true;
        if (_erc20Address == eligibleTokenAddresses["WETH"]) return true;
        if (_erc20Address == eligibleTokenAddresses["WMATIC"]) return true;
        return false;
    }

    // checks address and returns if can be used in a redeem
    // @param _erc20Address address of token to be checked
    function isRedeemable(address _erc20Address) private view returns (bool) {
        if (_erc20Address == eligibleTokenAddresses["BCT"]) return true;
        if (_erc20Address == eligibleTokenAddresses["NCT"]) return true;
        return false;
    }

    // @description uses SushiSwap to exchange tokens
    // @param _fromToken token to deposit and swap
    // @param _toToken token to receive after swap
    // @param _amount amount of NCT / BCT wanted
    // @notice needs to be approved on client side
    function swap(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) public {
        // check tokens
        require(
            isSwapable(_fromToken) && isSwapable(_toToken),
            "Can't swap this token"
        );

        // transfer token from user to this contract
        IERC20(_fromToken).safeTransferFrom(msg.sender, address(this), _amount);

        // approve sushi
        IERC20(_fromToken).approve(sushiRouterAddress, _amount);

        // instantiate sushi
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // establish path (in most cases token -> USDC -> NCT/BCT should work)
        address[] memory path = new address[](3);
        path[0] = _fromToken;
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = eligibleTokenAddresses["NCT"];

        // swap tokens for tokens
        routerSushi.swapTokensForExactTokens(
            _amount,
            (_amount * 10),
            path,
            msg.sender,
            block.timestamp
        );
    }

    // @description uses SushiSwap to exchange tokens
    // @param _toToken token to receive after swap
    // @param _amount amount of NCT / BCT to receive after swap
    // @notice needs to be approved on client side
    function swap(address _toToken, uint256 _amount) public payable {
        // check eligibility of token to swap for
        require(isSwapable(_toToken), "Can't swap for this token");

        // instantiate sushi
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // sushi router expects path[0] == WMATIC
        address[] memory path = new address[](3);
        path[0] = eligibleTokenAddresses["WMATIC"];
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = eligibleTokenAddresses["NCT"];

        // swap MATIC for tokens
        routerSushi.swapETHForExactTokens{value: msg.value}(
            _amount,
            path,
            msg.sender,
            block.timestamp
        );
    }

    // @description redeems an amount of NCT / BCT for TCO2
    // @param _fromToken "NCT" | "BCT"
    // @param _amount amount of NCT / BCT to redeem
    // @notice needs to be approved on the client side
    function autoRedeem(address _fromToken, uint256 _amount) public {
        require(
            // TODO add BCT once it has redeemAuto()
            isRedeemable(_fromToken),
            "Can't redeem this token."
        );

        if (_fromToken == eligibleTokenAddresses["NCT"]) {
            // store the contract in a variable for readability since it will be used a few times
            NatureCarbonTonne NCTImplementation = NatureCarbonTonne(_fromToken);

            // do a safe transfer from user to this contract;
            IERC20(_fromToken).safeTransferFrom(
                msg.sender,
                address(this),
                _amount
            );

            // auto redeem NCT for TCO2; will transfer to this contract automatically picked TCO2
            NCTImplementation.redeemAuto(_amount);

            // I'm attempting to loop over all possible TCO2s that I could have received from redeeming
            // and transfer of each to the user until the whole amount (minus fees) has been transferred
            // TODO may need to calculate fees differently
            uint256 remainingAmount = (_amount / 10) * 9;
            uint256 i = 0;
            address[] memory scoredTCO2s = NCTImplementation.getScoredTCO2s();
            uint256 scoredTCO2Len = scoredTCO2s.length;
            while (remainingAmount > 0 && i < scoredTCO2Len) {
                address tco2 = scoredTCO2s[i];
                uint256 balance = ToucanCarbonOffsets(tco2).balanceOf(
                    address(this)
                );
                uint256 amountToTransfer = remainingAmount > balance
                    ? balance
                    : remainingAmount;
                IERC20(tco2).transfer(msg.sender, amountToTransfer);
                remainingAmount -= amountToTransfer;
                i += 1;
            }
        }
    }

    function autoRetire(uint256 _amount) public {
        // TODO inspire from NatureCarbonTonne.redeemAuto() to make an autoRetire method
        // ToucanCarbonOffsets().retireFrom(msg.sender, _amount);
    }
}
