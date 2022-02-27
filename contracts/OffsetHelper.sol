//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CO2KEN_contracts/ToucanCarbonOffsets.sol";
import "./CO2KEN_contracts/pools/BaseCarbonTonne.sol";
import "./CO2KEN_contracts/pools/NCT.sol";
import "./OffsetHelperStorage.sol";
import "./uniswapv2/IUniswapV2Router02.sol";

// TODO making it non-custodial adds a lot of extra gas fees, could this be an issue?
contract OffsetHelper is OffsetHelperStorage {
    using SafeERC20 for IERC20;

    // checks address and returns token type or 'false' if not eligible
    // @param _erc20Address address of token to be checked
    function checkToken(address _erc20Address)
        private
        view
        returns (string memory)
    {
        bool isToucanContract = IToucanContractRegistry(contractRegistryAddress)
            .checkERC20(_erc20Address);

        if (isToucanContract) return "TCO2";

        // TODO implement a for loop instead
        if (_erc20Address == eligibleTokenAddresses["BCT"]) return "BCT";
        if (_erc20Address == eligibleTokenAddresses["NCT"]) return "NCT";
        if (_erc20Address == eligibleTokenAddresses["USDC"]) return "USDC";
        if (_erc20Address == eligibleTokenAddresses["WETH"]) return "WETH";
        if (_erc20Address == eligibleTokenAddresses["WMATIC"]) return "WMATIC";

        return "false";
    }

    // @description uses SushiSwap to exchange tokens
    // @param _fromToken token to deposit and swap
    // @param _toToken token to receive after swap
    // @param _amount amount to swap
    // @notice needs to be approved on client side
    function swap(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) public {
        // check tokens
        string memory eligibilityOfDepositedToken = checkToken(_fromToken);
        require(
            keccak256(abi.encodePacked(eligibilityOfDepositedToken)) !=
                keccak256(abi.encodePacked("false")),
            "Can't swap this token"
        );
        string memory eligibilityOfSwapedToken = checkToken(_toToken);
        require(
            keccak256(abi.encodePacked(eligibilityOfSwapedToken)) !=
                keccak256(abi.encodePacked("false")),
            "Can't swap for this token"
        );

        // transfer token from user to this contract
        IERC20(_fromToken).safeTransferFrom(msg.sender, address(this), _amount);

        // approve sushi
        IERC20(_fromToken).approve(sushiRouterAddress, _amount);

        // instantiate sushi
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // establish path (TODO in most cases token -> USDC -> NCT/BCT should work, but I need to test it out)
        // TODO how will I decide wether to use BCT / NCT?
        address[] memory path = new address[](3);
        path[0] = _fromToken;
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = eligibleTokenAddresses["NCT"];

        // swap tokens for tokens
        routerSushi.swapExactTokensForTokens(
            _amount,
            (_amount / 10) * 9,
            path,
            msg.sender,
            block.timestamp
        );
    }

    // @description uses SushiSwap to exchange tokens
    // @param _toToken token to receive after swap
    // @param _amount amount to swap
    // @notice needs to be approved on client side
    function swap(address _toToken) public payable {
        // TODO need to finish and test this function
        // check that user sent MATIC
        require(msg.value > 0, "You need to send some MATIC or a token");

        // instantiate sushi
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // sushi router expects path[0] == WETH
        // TODO how will I decide wether to use BCT / NCT?
        address[] memory path = new address[](3);
        path[0] = eligibleTokenAddresses["WETH"];
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = eligibleTokenAddresses["NCT"];

        // swap MATIC for tokens
        routerSushi.swapExactETHForTokens(
            (msg.value / 10) * 9,
            path,
            msg.sender,
            block.timestamp
        );
    }

    // @description redeems an amount of NCT / BCT for TCO2
    // @param _fromToken "NCT" | "BCT"
    // TODO it may make more sense to use address instead of string for _fromToken
    // @param _amount amount of NCT / BCT to redeem
    // @notice needs to be approved on the client side
    function autoRedeem(string memory _fromToken, uint256 _amount) public {
        require(
            keccak256(abi.encodePacked(_fromToken)) ==
                keccak256(abi.encodePacked("BCT")) ||
                keccak256(abi.encodePacked(_fromToken)) ==
                keccak256(abi.encodePacked("NCT")),
            "Can't redeem this token."
        );

        /// I'm keeping BCT commented out for now until they deploy redeemAuto() for it too
        // if (
        //     keccak256(abi.encodePacked(_fromToken)) ==
        //     keccak256(abi.encodePacked("BCT"))
        // ) {
        //     IERC20(eligibleTokenAddresses["BCT"]).safeTransferFrom(
        //         msg.sender,
        //         address(this),
        //         _amount
        //     );
        //     BaseCarbonTonne(eligibleTokenAddresses["BCT"]).redeemAuto(_amount);
        //     IERC20(eligibleTokenAddresses["BCT"]).transfer(msg.sender, _amount);
        // } else

        if (
            keccak256(abi.encodePacked(_fromToken)) ==
            keccak256(abi.encodePacked("NCT"))
        ) {
            // store the contract in a variable for readability since it will be used a few times
            NatureCarbonTonne NCTImplementation = NatureCarbonTonne(
                eligibleTokenAddresses["NCT"]
            );

            // do a safe transfer from user to this contract;
            IERC20(eligibleTokenAddresses["NCT"]).safeTransferFrom(
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
