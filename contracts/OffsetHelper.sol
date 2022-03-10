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

    // @description this is the autoOffset method for when the user wants to input tokens like USDC, WETH, WMATIC
    // @param _depositedToken the address of the token that the user sends (could be USDC, WETH, WMATIC)
    // @param _carbonToken the pool that the user wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    function autoOffset(
        address _depositedToken,
        address _carbonToken,
        uint256 _amountToOffset
    ) public {
        // swap input token for BCT / NCT
        swap(_depositedToken, _carbonToken, _amountToOffset);

        // redeem BCT / NCT for TCO2s
        autoRedeem(_carbonToken, _amountToOffset);

        // retire the TCO2s to achieve offset
        autoRetire(_amountToOffset, _carbonToken);
    }

    // @description this is the autoOffset method for when the user wants to input MATIC
    // @param _carbonToken the pool that the user wants to use (could be NCT or BCT)
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

    // @description this is the autoOffset method for when the user already has and wants to input BCT / NCT
    // @param _depositedToken the pool token that the user wants to use (could be NCT or BCT)
    // @param _amountToOffset the amount of TCO2 to offset
    function autoOffsetUsingRedeemableToken(
        address _depositedToken,
        uint256 _amountToOffset
    ) public {
        // deposit pool token from user to this contract
        deposit(_depositedToken, _amountToOffset);

        // redeem BCT / NCT for TCO2s
        autoRedeem(_depositedToken, _amountToOffset);

        // retire the TCO2s to achieve offset
        autoRetire(_amountToOffset, _depositedToken);
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
            "Can't swap this token"
        );

        // transfer token from user to this contract
        IERC20(_fromToken).safeTransferFrom(msg.sender, address(this), _amount);

        // approve sushi router
        IERC20(_fromToken).approve(sushiRouterAddress, _amount);

        // instantiate sushi router
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // establish path (in most cases token -> USDC -> NCT/BCT should work)
        address[] memory path = new address[](3);
        path[0] = _fromToken;
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;

        // swap input token for pool token
        uint256[] memory amountsIn = routerSushi.getAmountsIn(_amount, path);
        routerSushi.swapTokensForExactTokens(
            _amount,
            amountsIn[2],
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

    // TODO I need a method that tells people how much MATIC to send for the below swap method
    // otherwise they'll just send random MATIC amounts until it works and that's not ok
    function howMuchETHShouldISendToSwap(address _toToken, uint256 _amount)
        public
        view
        returns (uint256)
    {
        // require token to be redeemable
        require(isRedeemable(_toToken), "Can't swap for this token");

        // instantiate sushi router
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // establish path;
        // sushi router expects path[0] == WMATIC, but otherwise the path will resemble the one above
        address[] memory path = new address[](3);
        path[0] = eligibleTokenAddresses["WMATIC"];
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;
        uint256[] memory amounts = routerSushi.getAmountsIn(_amount, path);
        return amounts[0];
    }

    // @description uses SushiSwap to exchange MATIC for BCT / NCT
    // @param _toToken token to swap for (will be held within contract)
    // @param _amount amount of NCT / BCT wanted
    // @notice needs to be provided a message value on client side
    function swap(address _toToken, uint256 _amount) public payable {
        // The issue happens in the swapETHForExactTokens() method of the sushi router, right here:
        // https://github.com/sushiswap/sushiswap/blob/canary/contracts/uniswapv2/UniswapV2Router02.sol#L317
        // when calling TransferHelper.safeTransferETH() to send back unused MATIC to the user

        // Here is a link to the specific error from inside the safeTransferETH() method
        // https://github.com/sushiswap/sushiswap/blob/canary/contracts/uniswapv2/libraries/TransferHelper.sol#L27

        // check eligibility of token to swap for
        require(isRedeemable(_toToken), "Can't swap for this token");

        // instantiate sushi
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // sushi router expects path[0] == WMATIC, but otherwise the path will resemble the one above
        address[] memory path = new address[](3);
        path[0] = eligibleTokenAddresses["WMATIC"];
        path[1] = eligibleTokenAddresses["USDC"];
        path[2] = _toToken;

        // swap MATIC for tokens
        uint256[] memory amounts = routerSushi.swapETHForExactTokens{
            value: msg.value
        }(_amount, path, address(this), block.timestamp);

        if (msg.value > amounts[0]) {
            uint256 leftoverETH = msg.value - amounts[0];
            (bool success, ) = msg.sender.call{value: leftoverETH}(
                new bytes(0)
            );
            require(success, "Failed to send dust ETH back to user.");
        }

        // update balances
        balances[msg.sender][path[2]] += _amount;
    }

    // TODO interfaces folder + exchange CO2KEN_contracts for interfaces

    // @description allow users to withdraw tokens they have deposited
    function withdraw(address _erc20Addr, uint256 _amount) public {
        require(
            balances[msg.sender][_erc20Addr] >= _amount,
            "You don't have enough to withdraw."
        );

        IERC20(_erc20Addr).transfer(msg.sender, _amount);
        balances[msg.sender][_erc20Addr] -= _amount;
    }

    // @description allow people to deposit BCT / NCT
    // @notice needs to be approved
    function deposit(address _erc20Addr, uint256 _amount) public {
        require(isRedeemable(_erc20Addr), "Can't deposit this token");

        IERC20(_erc20Addr).safeTransferFrom(msg.sender, address(this), _amount);
        balances[msg.sender][_erc20Addr] += _amount;
    }

    // @description redeems an amount of NCT / BCT for TCO2
    // @param _fromToken could be the address of NCT or BCT
    // @param _amount amount to redeem
    // @notice needs to be approved on the client side
    function autoRedeem(address _fromToken, uint256 _amount) public {
        require(isRedeemable(_fromToken), "Can't redeem this token.");

        if (_fromToken == eligibleTokenAddresses["NCT"]) {
            require(
                balances[msg.sender][_fromToken] >= _amount,
                "You haven't deposited enough NCT"
            );

            // instantiate NCT
            NatureCarbonTonne NCTImplementation = NatureCarbonTonne(_fromToken);

            // auto redeem NCT for TCO2; will transfer automatically picked TCO2 to this contract
            NCTImplementation.redeemAuto(_amount);
            balances[msg.sender][_fromToken] -= _amount;

            // update TCO2 balances of the user to reflect the redeeming
            tco2Balance[msg.sender] += _amount;
            // TODO maybe I should also update a normal token balance? but then how can I reset it to 0 when I retire?
        }
    }

    // @param _amount the amount of TCO2 to retire
    // @param _pool the pool that will be used to get scoredTCO2s
    function autoRetire(uint256 _amount, address _pool) public {
        require(isRedeemable(_pool), "Can't use this pool for scoredTCO2s.");
        require(
            tco2Balance[msg.sender] >= _amount,
            "You don't have enough TCO2 in this contract."
        );

        if (_pool == eligibleTokenAddresses["NCT"]) {
            // instantiate NCT
            NatureCarbonTonne NCTImplementation = NatureCarbonTonne(_pool);

            // I'm attempting to loop over all possible TCO2s that the contract could have
            // see the contract's balance for said TCO2
            // and retire until the whole amount has been retired
            uint256 remainingAmount = _amount;
            uint256 i = 0;
            address[] memory scoredTCO2s = NCTImplementation.getScoredTCO2s();
            uint256 scoredTCO2Len = scoredTCO2s.length;
            while (remainingAmount > 0 && i < scoredTCO2Len) {
                address tco2 = scoredTCO2s[i];
                uint256 balance = IERC20(tco2).balanceOf(address(this));
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

            // record how much user has offset (will be useful in minting the NFT for user)
            overallOffsetAmount[msg.sender] += _amount;
        }
    }

    // @description mints NFT for all the TCO2 the user has offset through this contract
    function mintNFT() public {
        // require the user has overallOffsetAmount > 0
        // mint NFT
        // reset overallOffsetAmount for user to 0
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
