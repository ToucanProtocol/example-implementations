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

    // @description this is the autoOffset method you use if you have tokens like USDC, WETH, WMATIC
    // @param _depositedToken the token the user sends (could be USDC, WETH, WMATIC)
    // @param _carbonToken the redeem token that the user wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    function autoOffset(
        address _depositedToken,
        address _carbonToken,
        uint256 _amountToOffset
    ) public {
        // swap whatever token for BCT / NCT
        swap(_depositedToken, _carbonToken, _amountToOffset);

        // redeem BCT / NCT for TCO2s
        autoRedeem(_carbonToken, _amountToOffset);

        // retire the TCO2s to achieve offset
        autoRetire(_amountToOffset, _carbonToken);
    }

    // @description this is the autoOffset method you use if you have MATIC, but no tokens
    // @param _carbonToken the redeem token that the user wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    function autoOffset(address _carbonToken, uint256 _amountToOffset)
        public
        payable
    {
        // swap MATIC for BCT / NCT
        swap(_carbonToken, _amountToOffset);

        // redeem BCT / NCT for TCO2s
        autoRedeem(_carbonToken, _amountToOffset);

        // retire the TCO2s to achieve offset
        autoRetire(_amountToOffset, _carbonToken);
    }

    // @description this is the autoOffset method you use if you already have BCT / NCT
    // @param _depositedToken the redeem token that the user deposited & wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    function autoOffsetUsingRedeemableToken(
        address _depositedToken,
        uint256 _amountToOffset
    ) public {
        deposit(_depositedToken, _amountToOffset);

        // redeem BCT / NCT for TCO2s
        autoRedeem(_depositedToken, _amountToOffset);

        // retire the TCO2s to achieve offset
        autoRetire(_amountToOffset, _depositedToken);
    }

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

    // @description uses SushiSwap to exchange tokens for BCT / NCT that is deposited in this contract
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
            isSwapable(_fromToken) && isRedeemable(_toToken),
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
        path[2] = _toToken;

        // swap tokens for tokens
        routerSushi.swapTokensForExactTokens(
            _amount,
            (_amount * 10),
            path,
            address(this),
            block.timestamp
        );
        balances[msg.sender][path[2]] += _amount;
    }

    // @description uses SushiSwap to exchange MATIC for BCT / NCT that is deposited in this contract
    // @param _toToken token to receive after swap
    // @param _amount amount of NCT / BCT to receive after swap
    // @notice needs to be provided a message value on client side
    function swap(address _toToken, uint256 _amount) public payable {
        // check eligibility of token to swap for
        require(isRedeemable(_toToken), "Can't swap for this token");

        // instantiate sushi
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // sushi router expects path[0] == WMATIC
        address[] memory path = new address[](3);
        path[0] = eligibleTokenAddresses["WMATIC"];
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;

        // swap MATIC for tokens
        // TODO maybe keep the token within this contract since I won't be using retireFrom() anymore anyway
        // and this is becoming semi-custodial
        routerSushi.swapETHForExactTokens{value: msg.value}(
            _amount,
            path,
            address(this),
            block.timestamp
        );
        balances[msg.sender][path[2]] += _amount;
    }

    // @description allow people to deposit BCT / NCT
    // @notice needs to be approved
    function deposit(address _erc20Addr, uint256 _amount) public {
        // TODO build this method
        require(isRedeemable(_erc20Addr), "Can't deposit this token");

        IERC20(_erc20Addr).safeTransferFrom(msg.sender, address(this), _amount);
        balances[msg.sender][_erc20Addr] += _amount;
    }

    // @description redeems an amount of NCT / BCT for TCO2
    // @param _fromToken "NCT" | "BCT"
    // @param _amount amount of NCT / BCT to redeem
    // @notice needs to be approved on the client side
    function autoRedeem(address _fromToken, uint256 _amount) public {
        require(isRedeemable(_fromToken), "Can't redeem this token.");

        if (_fromToken == eligibleTokenAddresses["NCT"]) {
            require(
                balances[msg.sender][_fromToken] >= _amount,
                "You haven't deposited enough NCT"
            );

            // store the contract in a variable for readability since it will be used a few times
            NatureCarbonTonne NCTImplementation = NatureCarbonTonne(_fromToken);

            // auto redeem NCT for TCO2; will transfer to this contract automatically picked TCO2
            NCTImplementation.redeemAuto(_amount);
            balances[msg.sender][_fromToken] -= _amount;

            // update TCO2 balances of the user to reflect the redeeming
            tco2Balance[msg.sender] += _amount;
        }
    }

    // @param _amount the amount of TCO2 to retire
    // @param _pool the pool that will be used to get scoredTCO2s
    function autoRetire(uint256 _amount, address _pool) public {
        require(isRedeemable(_pool), "Can't use this pool.");

        if (_pool == eligibleTokenAddresses["NCT"]) {
            // store the contract in a variable for readability since it will be used a few times
            NatureCarbonTonne NCTImplementation = NatureCarbonTonne(_pool);

            // I'm attempting to loop over all possible TCO2s that the contract could have
            // and retire each until the whole amount has been retired / offset
            uint256 remainingAmount = _amount;
            uint256 i = 0;
            address[] memory scoredTCO2s = NCTImplementation.getScoredTCO2s();
            uint256 scoredTCO2Len = scoredTCO2s.length;
            while (remainingAmount > 0 && i < scoredTCO2Len) {
                address tco2 = scoredTCO2s[i];
                uint256 balance = balances[msg.sender][tco2];
                i += 1;
                if (balance == 0) continue;
                uint256 amountToRetire = remainingAmount > balance
                    ? balance
                    : remainingAmount;
                ToucanCarbonOffsets(tco2).retire(amountToRetire);
                remainingAmount -= amountToRetire;
            }

            // update the user's TCO2 balance
            tco2Balance[msg.sender] -= _amount;
        }
    }

    // TODO a method to mint retirements NFT
}
