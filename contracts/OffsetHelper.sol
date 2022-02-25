//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CO2KEN_contracts/ToucanCarbonOffsets.sol";
import "./CO2KEN_contracts/pools/BaseCarbonTonne.sol";
import "./CO2KEN_contracts/pools/NCT.sol";
import "./OffsetHelperStorage.sol";

// TODO making it non-custodial adds a lot of extra gas fees
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

    // @description uses SushiSwap to exchange tokens (right in the user's wallet, meaning non-custodial)
    // @param _fromToken token to deposit and swap
    // @param _toToken token to receive after swap
    // @param _amount amount to swap
    function swap(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) public {
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

        // TODO use Sushi to swap tokens
    }

    // @description redeems an amount of NCT / BCT for TCO2
    // @param _fromToken "NCT" | "BCT"
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
            // TODO issue when getting scored TCO2s, maybe because there isn't a scoredTCO2s array on mumbai?
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
