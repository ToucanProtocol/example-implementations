//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./CO2KEN_contracts/ToucanCarbonOffsets.sol";
import "./CO2KEN_contracts/pools/BaseCarbonTonne.sol";
import "./CO2KEN_contracts/pools/NCT.sol";
import "./CO2KEN_contracts/IToucanContractRegistry.sol";

contract OffsetHelperStorage is OwnableUpgradeable {
    mapping(string => address) public eligibleTokenAddresses;
    address public contractRegistryAddress =
        0x6739D490670B2710dc7E79bB12E455DE33EE1cb6;
    address public sushiRouterAddress =
        0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506; // this is polygon, not mumbai

    constructor() {
        eligibleTokenAddresses[
            "BCT"
        ] = 0xf2438A14f668b1bbA53408346288f3d7C71c10a1;

        eligibleTokenAddresses[
            "NCT"
        ] = 0x7beCBA11618Ca63Ead5605DE235f6dD3b25c530E;

        eligibleTokenAddresses[
            "USDC"
        ] = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174; // this is polygon, not mumbai

        eligibleTokenAddresses[
            "WETH"
        ] = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619; // this is polygon, not mumbai

        eligibleTokenAddresses[
            "WMATIC"
        ] = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270; // this is polygon, not mumbai
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
