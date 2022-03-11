// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

interface IToucanCarbonOffsets {
    function retire(uint256 amount) external;

    function retireFrom(address account, uint256 amount) external;
}
