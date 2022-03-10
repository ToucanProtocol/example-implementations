//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./CO2KEN_contracts/ToucanCarbonOffsets.sol";
import "./CO2KEN_contracts/pools/BaseCarbonTonne.sol";
import "./CO2KEN_contracts/pools/NCT.sol";
import "./CO2KEN_contracts/IToucanContractRegistry.sol";

contract OffsetHelperStorage is OwnableUpgradeable {
    // token symbol => token address
    mapping(string => address) public eligibleTokenAddresses;
    address public contractRegistryAddress =
        0x263fA1c180889b3a3f46330F32a4a23287E99FC9;
    address public sushiRouterAddress =
        0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    // user => (token => amount)
    mapping(address => mapping(address => uint256)) public balances;
    // user => amount
    mapping(address => uint256) public tco2Balance;
    // user => amount they've offset with this contract since it's been deployed
    mapping(address => uint256) public overallOffsetAmount;

    constructor() {
        // TODO make these be assigned dynamically through the constructor
        eligibleTokenAddresses[
            "BCT"
        ] = 0x2F800Db0fdb5223b3C3f354886d907A671414A7F;

        eligibleTokenAddresses[
            "NCT"
        ] = 0xD838290e877E0188a4A44700463419ED96c16107;

        eligibleTokenAddresses[
            "USDC"
        ] = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;

        eligibleTokenAddresses[
            "WETH"
        ] = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619;

        eligibleTokenAddresses[
            "WMATIC"
        ] = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
    }

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
