// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

interface IToucanPoolToken {
    function redeemAuto(uint256 amount) external;

    function redeemMany(address[] memory erc20s, uint256[] memory amounts)
        external;
}
