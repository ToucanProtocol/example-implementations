//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CO2KEN_contracts/ToucanCarbonOffsets.sol";
import "./CO2KEN_contracts/pools/BaseCarbonTonne.sol";
import "./CO2KEN_contracts/pools/NCT.sol";
import "./OffsetHelperStorage.sol";

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
    function autoRedeem(string memory _fromToken, uint256 _amount) public {
        require(
            keccak256(abi.encodePacked(_fromToken)) ==
                keccak256(abi.encodePacked("BCT")) ||
                keccak256(abi.encodePacked(_fromToken)) ==
                keccak256(abi.encodePacked("NCT")),
            "Can't redeem this token."
        );

        // take BCT / NCT from user, redeem it for TCO2 & send back to user
        // needs to be approved

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
            IERC20(eligibleTokenAddresses["NCT"]).safeTransferFrom(
                msg.sender,
                address(this),
                _amount
            );
            NatureCarbonTonne(eligibleTokenAddresses["NCT"]).redeemAuto(
                _amount
            );
            IERC20(eligibleTokenAddresses["NCT"]).transfer(msg.sender, _amount);
        }
    }

    function autoRetire(uint256 _amount) public {
        // TODO inspire from NatureCarbonTonne.redeemAuto() to make an autoRetire method
        // ToucanCarbonOffsets().retireFrom(msg.sender, _amount);
    }
}
