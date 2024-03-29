import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { formatEther, parseEther, parseUnits } from "ethers/lib/utils";

import * as hardhatContracts from "../utils/toucanContracts.json";
import * as poolContract from "../artifacts/contracts/interfaces/IToucanPoolToken.sol/IToucanPoolToken.json";
import {
  IToucanPoolToken,
  OffsetHelper,
  OffsetHelper__factory,
  Swapper,
  Swapper__factory,
} from "../typechain";
import addresses from "../utils/addresses";
import { BigNumber, Contract } from "ethers";
import { usdcABI, wethABI, wmaticABI } from "../utils/ABIs";

const ONE_ETHER = parseEther("1.0");

describe("Offset Helper - autoOffset", function () {
  let offsetHelper: OffsetHelper;
  let swapper: Swapper;
  let bct: IToucanPoolToken;
  let nct: IToucanPoolToken;
  let weth: Contract;
  let wmatic: Contract;
  let usdc: Contract;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addrs: SignerWithAddress[];

  beforeEach(async function () {
    [addr1, addr2, ...addrs] = await ethers.getSigners();

    const offsetHelperFactory = (await ethers.getContractFactory(
      "OffsetHelper",
      addr2
    )) as OffsetHelper__factory;
    offsetHelper = await offsetHelperFactory.deploy(
      ["BCT", "NCT", "USDC", "WETH", "WMATIC"],
      [
        addresses.bct,
        addresses.nct,
        addresses.usdc,
        addresses.weth,
        addresses.wmatic,
      ]
    );

    weth = new ethers.Contract(addresses.weth, wethABI, addr2);
    wmatic = new ethers.Contract(addresses.wmatic, wmaticABI, addr2);
    usdc = new ethers.Contract(addresses.usdc, usdcABI, addr2);

    nct = new ethers.Contract(
      addresses.nct,
      hardhatContracts.contracts.NatureCarbonTonne.abi,
      addr2
    ) as IToucanPoolToken;

    bct = new ethers.Contract(
      addresses.bct,
      poolContract.abi,
      addr2
    ) as IToucanPoolToken;
  });

  before(async () => {
    [addr1, addr2, ...addrs] = await ethers.getSigners();

    const swapperFactory = (await ethers.getContractFactory(
      "Swapper",
      addr2
    )) as Swapper__factory;
    swapper = await swapperFactory.deploy(
      ["BCT", "NCT", "USDC", "WETH", "WMATIC"],
      [
        addresses.bct,
        addresses.nct,
        addresses.usdc,
        addresses.weth,
        addresses.wmatic,
      ]
    );

    await Promise.all(
      addrs.map(async (addr) => {
        await addr.sendTransaction({
          to: addr2.address,
          value: (await addr.getBalance()).sub(ONE_ETHER),
        });
      })
    );

    await swapper.swap(addresses.weth, parseEther("20.0"), {
      value: await swapper.calculateNeededETHAmount(
        addresses.weth,
        parseEther("20.0")
      ),
    });

    await swapper.swap(addresses.usdc, parseUnits("20.0", 6), {
      value: await swapper.calculateNeededETHAmount(
        addresses.usdc,
        parseUnits("20.0", 6)
      ),
    });

    await swapper.swap(addresses.bct, parseEther("50.0"), {
      value: await swapper.calculateNeededETHAmount(
        addresses.bct,
        parseEther("50.0")
      ),
    });

    await swapper.swap(addresses.nct, parseEther("50.0"), {
      value: await swapper.calculateNeededETHAmount(
        addresses.nct,
        parseEther("50.0")
      ),
    });
  });

  describe("Testing autoOffset()", function () {
    it("should retire 1.0 TCO2 using a WETH swap and NCT redemption", async function () {
      // first we set the initial chain state
      const wethBalanceBefore = await weth.balanceOf(addr2.address);
      const nctSupplyBefore = await nct.totalSupply();

      // then we calculate the cost in WETH of retiring 1.0 TCO2
      const wethCost = await offsetHelper.calculateNeededTokenAmount(
        addresses.weth,
        addresses.nct,
        ONE_ETHER
      );

      // then we use the autoOffset function to retire 1.0 TCO2 from WETH using NCT
      await (await weth.approve(offsetHelper.address, wethCost)).wait();
      await offsetHelper.autoOffsetUsingToken(
        addresses.weth,
        addresses.nct,
        ONE_ETHER
      );

      // then we set the chain state after the transaction
      const wethBalanceAfter = await weth.balanceOf(addr2.address);
      const nctSupplyAfter = await nct.totalSupply();

      // and we compare chain states
      expect(
        formatEther(wethBalanceBefore.sub(wethBalanceAfter)),
        `User should have spent ${formatEther(wethCost)}} WETH`
      ).to.equal(formatEther(wethCost));
      expect(
        formatEther(nctSupplyBefore.sub(nctSupplyAfter)),
        "Total supply of NCT should have decreased by 1"
      ).to.equal("1.0");
    });

    it("should retire using a MATIC swap and NCT redemption", async function () {
      // first we set the initial chain state
      const maticBalanceBefore = await addr2.getBalance();
      const nctSupplyBefore = await nct.totalSupply();

      // then we calculate the cost in MATIC of retiring 1.0 TCO2
      const maticCost = await offsetHelper.calculateNeededETHAmount(
        addresses.nct,
        ONE_ETHER
      );

      // then we use the autoOffset function to retire 1.0 TCO2 from MATIC using NCT
      const tx = await (
        await offsetHelper.autoOffsetUsingETH(addresses.nct, ONE_ETHER, {
          value: maticCost,
        })
      ).wait();

      // we calculate the used gas
      const txFees = tx.gasUsed.mul(tx.effectiveGasPrice);

      // and we set the chain state after the transaction
      const maticBalanceAfter = await addr2.getBalance();
      const nctSupplyAfter = await nct.totalSupply();

      // lastly we compare chain states
      expect(
        formatEther(maticBalanceBefore.sub(maticBalanceAfter)),
        `User should have spent ${formatEther(maticCost)}} MATIC`
      ).to.equal(formatEther(maticCost.add(txFees)));
      expect(
        formatEther(nctSupplyBefore.sub(nctSupplyAfter)),
        "Total supply of NCT should have decreased by 1"
      ).to.equal("1.0");
    });

    it("should retire using a NCT deposit and NCT redemption", async function () {
      // first we set the initial chain state
      const nctBalanceBefore = await nct.balanceOf(addr2.address);
      const nctSupplyBefore = await nct.totalSupply();

      // then we use the autoOffset function to retire 1.0 TCO2 from NCT
      await (await nct.approve(offsetHelper.address, ONE_ETHER)).wait();
      await offsetHelper.autoOffsetUsingPoolToken(addresses.nct, ONE_ETHER);

      // then we set the chain state after the transaction
      const nctBalanceAfter = await nct.balanceOf(addr2.address);
      const nctSupplyAfter = await nct.totalSupply();

      // and we compare chain states
      expect(
        formatEther(nctBalanceBefore.sub(nctBalanceAfter)),
        `User should have spent 1.0 NCT`
      ).to.equal("1.0");
      expect(
        formatEther(nctSupplyBefore.sub(nctSupplyAfter)),
        "Total supply of NCT should have decreased by 1"
      ).to.equal("1.0");
    });

    it("should retire using a WETH swap and BCT redemption", async function () {
      // first we set the initial chain state
      const wethBalanceBefore = await weth.balanceOf(addr2.address);
      const bctSupplyBefore = await bct.totalSupply();

      // then we calculate the cost in WETH of retiring 1.0 TCO2
      const wethCost = await offsetHelper.calculateNeededTokenAmount(
        addresses.weth,
        addresses.bct,
        ONE_ETHER
      );

      // then we use the autoOffset function to retire 1.0 TCO2 from WETH using BCT
      await (await weth.approve(offsetHelper.address, wethCost)).wait();
      await offsetHelper.autoOffsetUsingToken(
        addresses.weth,
        addresses.bct,
        ONE_ETHER
      );

      // then we set the chain state after the transaction
      const wethBalanceAfter = await weth.balanceOf(addr2.address);
      const bctSupplyAfter = await bct.totalSupply();

      // and we compare chain states
      expect(
        formatEther(wethBalanceBefore.sub(wethBalanceAfter)),
        `User should have spent ${formatEther(wethCost)}} WETH`
      ).to.equal(formatEther(wethCost));
      expect(
        formatEther(bctSupplyBefore.sub(bctSupplyAfter)),
        "Total supply of BCT should have decreased by 1"
      ).to.equal("1.0");
    });

    it("should retire using a USDC swap and NCT redemption", async function () {
      // first we set the initial chain state
      const usdcBalanceBefore = await usdc.balanceOf(addr2.address);
      const nctSupplyBefore = await nct.totalSupply();

      // then we calculate the cost in USDC of retiring 1.0 TCO2
      const usdcCost = await offsetHelper.calculateNeededTokenAmount(
        addresses.usdc,
        addresses.nct,
        ONE_ETHER
      );

      // then we use the autoOffset function to retire 1.0 TCO2 from USDC using NCT
      await (await usdc.approve(offsetHelper.address, usdcCost)).wait();
      await offsetHelper.autoOffsetUsingToken(
        addresses.usdc,
        addresses.nct,
        ONE_ETHER
      );

      // then we set the chain state after the transaction
      const usdcBalanceAfter = await usdc.balanceOf(addr2.address);
      const nctSupplyAfter = await nct.totalSupply();

      // and we compare chain states
      expect(
        formatEther(usdcBalanceBefore.sub(usdcBalanceAfter)),
        `User should have spent ${formatEther(usdcCost)}} USDC`
      ).to.equal(formatEther(usdcCost));
      expect(
        formatEther(nctSupplyBefore.sub(nctSupplyAfter)),
        "Total supply of NCT should have decreased by 1"
      ).to.equal("1.0");
    });

    it("should retire using a WMATIC swap and NCT redemption", async function () {
      // first we wrap some matic
      await wmatic.deposit({
        value: parseEther("20.0"),
      });

      // then we set the initial chain state
      const wmaticBalanceBefore = await wmatic.balanceOf(addr2.address);
      const nctSupplyBefore = await nct.totalSupply();

      // and we calculate the cost in WMATIC of retiring 1.0 TCO2
      const wmaticCost = await offsetHelper.calculateNeededTokenAmount(
        addresses.wmatic,
        addresses.nct,
        ONE_ETHER
      );

      // we use the autoOffset function to retire 1.0 TCO2 from WMATIC using NCT
      await (await wmatic.approve(offsetHelper.address, wmaticCost)).wait();
      await offsetHelper.autoOffsetUsingToken(
        addresses.wmatic,
        addresses.nct,
        ONE_ETHER
      );

      // then we set the chain state after the transaction
      const wmaticBalanceAfter = await wmatic.balanceOf(addr2.address);
      const nctSupplyAfter = await nct.totalSupply();

      // and we compare chain states
      expect(
        formatEther(wmaticBalanceBefore.sub(wmaticBalanceAfter)),
        `User should have spent ${formatEther(wmaticCost)} WMATIC`
      ).to.equal(formatEther(wmaticCost));
      expect(
        formatEther(nctSupplyBefore.sub(nctSupplyAfter)),
        "Total supply of NCT should have decreased by 1"
      ).to.equal("1.0");
    });
  });

  describe("Testing autoRedeem()", function () {
    it("should redeem NCT from deposit", async function () {
      // first we set the initial chain state
      const states: {
        userNctBalance: BigNumber;
        contractNctBalance: BigNumber;
        nctSupply: BigNumber;
      }[] = [];
      states.push({
        userNctBalance: await nct.balanceOf(addr2.address),
        contractNctBalance: await nct.balanceOf(offsetHelper.address),
        nctSupply: await nct.totalSupply(),
      });

      // then we deposit 1.0 NCT into the OH contract
      await (await nct.approve(offsetHelper.address, ONE_ETHER)).wait();
      await (await offsetHelper.deposit(addresses.nct, ONE_ETHER)).wait();

      // then we set the chain state after the deposit transaction
      states.push({
        userNctBalance: await nct.balanceOf(addr2.address),
        contractNctBalance: await nct.balanceOf(offsetHelper.address),
        nctSupply: await nct.totalSupply(),
      });

      // and we compare chain states post deposit
      expect(
        formatEther(states[0].userNctBalance.sub(states[1].userNctBalance)),
        "User should have 1 less NCT post deposit"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(
          states[1].contractNctBalance.sub(states[0].contractNctBalance)
        ),
        "Contract should have 1 more NCT post deposit"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(states[0].nctSupply),
        "NCT supply should be the same post deposit"
      ).to.equal(formatEther(states[1].nctSupply));

      // we redeem 1.0 NCT from the OH contract for TCO2s
      await offsetHelper.autoRedeem(addresses.nct, ONE_ETHER);

      // then we set the chain state after the redeem transaction
      states.push({
        userNctBalance: await nct.balanceOf(addr2.address),
        contractNctBalance: await nct.balanceOf(offsetHelper.address),
        nctSupply: await nct.totalSupply(),
      });

      // and we compare chain states post redeem
      expect(
        formatEther(states[1].userNctBalance),
        "User should have the same amount of NCT post redeem"
      ).to.equal(formatEther(states[2].userNctBalance));
      expect(
        formatEther(
          states[1].contractNctBalance.sub(states[2].contractNctBalance)
        ),
        "Contract should have 1 less NCT post redeem"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(states[1].nctSupply.sub(states[2].nctSupply)),
        "NCT supply should be less by 1 post redeem"
      ).to.equal(formatEther(ONE_ETHER));
    });

    it("Should fail because we haven't deposited NCT", async function () {
      await expect(
        offsetHelper.autoRedeem(addresses.nct, ONE_ETHER)
      ).to.be.revertedWith("Insufficient NCT/BCT balance");
    });

    it("should redeem BCT from deposit", async function () {
      // first we set the initial chain state
      const states: {
        userBctBalance: BigNumber;
        contractBctBalance: BigNumber;
        bctSupply: BigNumber;
      }[] = [];
      states.push({
        userBctBalance: await bct.balanceOf(addr2.address),
        contractBctBalance: await bct.balanceOf(offsetHelper.address),
        bctSupply: await bct.totalSupply(),
      });

      // then we deposit 1.0 BCT into the OH contract
      await (await bct.approve(offsetHelper.address, ONE_ETHER)).wait();
      await (await offsetHelper.deposit(addresses.bct, ONE_ETHER)).wait();

      // then we set the chain state after the deposit transaction
      states.push({
        userBctBalance: await bct.balanceOf(addr2.address),
        contractBctBalance: await bct.balanceOf(offsetHelper.address),
        bctSupply: await bct.totalSupply(),
      });

      // and we compare chain states post deposit
      expect(
        formatEther(states[0].userBctBalance.sub(states[1].userBctBalance)),
        "User should have 1 less BCT post deposit"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(
          states[1].contractBctBalance.sub(states[0].contractBctBalance)
        ),
        "Contract should have 1 more BCT post deposit"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(states[0].bctSupply),
        "BCT supply should be the same post deposit"
      ).to.equal(formatEther(states[1].bctSupply));

      // we redeem 1.0 BCT from the OH contract for TCO2s
      await offsetHelper.autoRedeem(addresses.bct, ONE_ETHER);

      // then we set the chain state after the redeem transaction
      states.push({
        userBctBalance: await bct.balanceOf(addr2.address),
        contractBctBalance: await bct.balanceOf(offsetHelper.address),
        bctSupply: await bct.totalSupply(),
      });

      // and we compare chain states post redeem
      expect(
        formatEther(states[1].userBctBalance),
        "User should have the same amount of BCT post redeem"
      ).to.equal(formatEther(states[2].userBctBalance));
      expect(
        formatEther(
          states[1].contractBctBalance.sub(states[2].contractBctBalance)
        ),
        "Contract should have 1 less BCT post redeem"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(states[1].bctSupply.sub(states[2].bctSupply)),
        "BCT supply should be less by 1 post redeem"
      ).to.equal(formatEther(ONE_ETHER));
    });
  });

  describe("Testing autoRetire()", function () {
    it("should retire using an NCT deposit", async function () {
      // first we set the initial state
      const state: {
        userNctBalance: BigNumber;
        contractNctBalance: BigNumber;
        nctSupply: BigNumber;
      }[] = [];
      state.push({
        userNctBalance: await nct.balanceOf(addr2.address),
        contractNctBalance: await nct.balanceOf(offsetHelper.address),
        nctSupply: await nct.totalSupply(),
      });

      // we deposit NCT into OH
      await (await nct.approve(offsetHelper.address, ONE_ETHER)).wait();
      await (await offsetHelper.deposit(addresses.nct, ONE_ETHER)).wait();

      // and we check the state after the deposit
      state.push({
        userNctBalance: await nct.balanceOf(addr2.address),
        contractNctBalance: await nct.balanceOf(offsetHelper.address),
        nctSupply: await nct.totalSupply(),
      });
      expect(
        formatEther(state[0].userNctBalance.sub(state[1].userNctBalance)),
        "User should have 1 less NCT post deposit"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(
          state[1].contractNctBalance.sub(state[0].contractNctBalance)
        ),
        "Contract should have 1 more NCT post deposit"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(state[0].nctSupply),
        "NCT supply should be the same post deposit"
      ).to.equal(formatEther(state[1].nctSupply));

      // we redeem NCT for TCO2 within OH
      const redeemReceipt = await (
        await offsetHelper.autoRedeem(addresses.nct, ONE_ETHER)
      ).wait();

      // and we check the state after the redeem
      state.push({
        userNctBalance: await nct.balanceOf(addr2.address),
        contractNctBalance: await nct.balanceOf(offsetHelper.address),
        nctSupply: await nct.totalSupply(),
      });
      expect(
        formatEther(state[1].userNctBalance),
        "User should have the same amount of NCT post redeem"
      ).to.equal(formatEther(state[2].userNctBalance));
      expect(
        formatEther(
          state[1].contractNctBalance.sub(state[2].contractNctBalance)
        ),
        "Contract should have 1 less NCT post redeem"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(state[1].nctSupply.sub(state[2].nctSupply)),
        "NCT supply should be less by 1 post redeem"
      ).to.equal(formatEther(ONE_ETHER));

      // we get the tco2s and amounts that were redeemed
      if (!redeemReceipt.events) throw new Error("No events emitted");
      const tco2s =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.tco2s;
      const amounts =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.amounts;

      // we retire the tco2s
      await offsetHelper.autoRetire(tco2s, amounts);

      // and we check the state after the retire
      state.push({
        userNctBalance: await nct.balanceOf(addr2.address),
        contractNctBalance: await nct.balanceOf(offsetHelper.address),
        nctSupply: await nct.totalSupply(),
      });
      expect(
        formatEther(state[2].userNctBalance),
        "User should have the same amount of NCT post retire"
      ).to.equal(formatEther(state[3].userNctBalance));
      expect(
        formatEther(state[2].contractNctBalance),
        "Contract should have the same amount of NCT post retire"
      ).to.equal(formatEther(state[3].contractNctBalance));
      expect(
        formatEther(state[2].nctSupply),
        "NCT supply should be the same post retire"
      ).to.equal(formatEther(state[3].nctSupply));
    });

    it("Should fail because we haven't redeemed any TCO2", async function () {
      await expect(
        offsetHelper.autoRetire(
          ["0xb139C4cC9D20A3618E9a2268D73Eff18C496B991"],
          [ONE_ETHER]
        )
      ).to.be.revertedWith("Insufficient TCO2 balance");
    });

    it("should retire using an BCT deposit", async function () {
      // first we set the initial state
      const state: {
        userBctBalance: BigNumber;
        contractBctBalance: BigNumber;
        bctSupply: BigNumber;
      }[] = [];
      state.push({
        userBctBalance: await bct.balanceOf(addr2.address),
        contractBctBalance: await bct.balanceOf(offsetHelper.address),
        bctSupply: await bct.totalSupply(),
      });

      // we deposit BCT into OH
      await (await bct.approve(offsetHelper.address, ONE_ETHER)).wait();
      await (await offsetHelper.deposit(addresses.bct, ONE_ETHER)).wait();

      // and we check the state after the deposit
      state.push({
        userBctBalance: await bct.balanceOf(addr2.address),
        contractBctBalance: await bct.balanceOf(offsetHelper.address),
        bctSupply: await bct.totalSupply(),
      });
      expect(
        formatEther(state[0].userBctBalance.sub(state[1].userBctBalance)),
        "User should have 1 less BCT post deposit"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(
          state[1].contractBctBalance.sub(state[0].contractBctBalance)
        ),
        "Contract should have 1 more BCT post deposit"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(state[0].bctSupply),
        "BCT supply should be the same post deposit"
      ).to.equal(formatEther(state[1].bctSupply));

      // we redeem BCT for TCO2 within OH
      const redeemReceipt = await (
        await offsetHelper.autoRedeem(addresses.bct, ONE_ETHER)
      ).wait();

      // and we check the state after the redeem
      state.push({
        userBctBalance: await bct.balanceOf(addr2.address),
        contractBctBalance: await bct.balanceOf(offsetHelper.address),
        bctSupply: await bct.totalSupply(),
      });
      expect(
        formatEther(state[1].userBctBalance),
        "User should have the same amount of BCT post redeem"
      ).to.equal(formatEther(state[2].userBctBalance));
      expect(
        formatEther(
          state[1].contractBctBalance.sub(state[2].contractBctBalance)
        ),
        "Contract should have 1 less BCT post redeem"
      ).to.equal(formatEther(ONE_ETHER));
      expect(
        formatEther(state[1].bctSupply.sub(state[2].bctSupply)),
        "BCT supply should be less by 1 post redeem"
      ).to.equal(formatEther(ONE_ETHER));

      // we get the tco2s and amounts that were redeemed
      if (!redeemReceipt.events) throw new Error("No events emitted");
      const tco2s =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.tco2s;
      const amounts =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.amounts;

      // we retire the tco2s
      await offsetHelper.autoRetire(tco2s, amounts);

      // and we check the state after the retire
      state.push({
        userBctBalance: await bct.balanceOf(addr2.address),
        contractBctBalance: await bct.balanceOf(offsetHelper.address),
        bctSupply: await bct.totalSupply(),
      });
      expect(
        formatEther(state[2].userBctBalance),
        "User should have the same amount of BCT post retire"
      ).to.equal(formatEther(state[3].userBctBalance));
      expect(
        formatEther(state[2].contractBctBalance),
        "Contract should have the same amount of BCT post retire"
      ).to.equal(formatEther(state[3].contractBctBalance));
      expect(
        formatEther(state[2].bctSupply),
        "BCT supply should be the same post retire"
      ).to.equal(formatEther(state[3].bctSupply));
    });
  });

  describe("Testing deposit() and withdraw()", function () {
    it("Should deposit 1.0 NCT", async function () {
      await (await nct.approve(offsetHelper.address, ONE_ETHER)).wait();

      await (await offsetHelper.deposit(addresses.nct, ONE_ETHER)).wait();

      expect(
        formatEther(await offsetHelper.balances(addr2.address, addresses.nct))
      ).to.be.eql("1.0");
    });

    it("Should fail to deposit because we have no NCT", async function () {
      await (
        await nct.connect(addrs[0]).approve(offsetHelper.address, ONE_ETHER)
      ).wait();

      await expect(
        offsetHelper.connect(addrs[0]).deposit(addresses.nct, ONE_ETHER)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should deposit and withdraw 1.0 NCT", async function () {
      const preDepositNCTBalance = await nct.balanceOf(addr2.address);

      await (await nct.approve(offsetHelper.address, ONE_ETHER)).wait();

      await (await offsetHelper.deposit(addresses.nct, ONE_ETHER)).wait();

      await (await offsetHelper.withdraw(addresses.nct, ONE_ETHER)).wait();

      const postWithdrawNCTBalance = await nct.balanceOf(addr2.address);

      expect(formatEther(postWithdrawNCTBalance)).to.be.eql(
        formatEther(preDepositNCTBalance)
      );
    });

    it("Should fail to withdraw because we haven't deposited enough NCT", async function () {
      await (await nct.approve(offsetHelper.address, ONE_ETHER)).wait();

      await (await offsetHelper.deposit(addresses.nct, ONE_ETHER)).wait();

      await expect(
        offsetHelper.withdraw(addresses.nct, parseEther("2.0"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should deposit 1.0 BCT", async function () {
      await (await bct.approve(offsetHelper.address, ONE_ETHER)).wait();

      await (await offsetHelper.deposit(addresses.bct, ONE_ETHER)).wait();

      expect(
        formatEther(await offsetHelper.balances(addr2.address, addresses.bct))
      ).to.be.eql("1.0");
    });
  });

  describe("swap() for NCT", function () {
    it("Should swap WETH for 1.0 NCT", async function () {
      const initialBalance = await nct.balanceOf(offsetHelper.address);

      await (
        await weth.approve(
          offsetHelper.address,
          await offsetHelper.calculateNeededTokenAmount(
            addresses.weth,
            addresses.nct,
            ONE_ETHER
          )
        )
      ).wait();

      await (
        await offsetHelper["swap(address,address,uint256)"](
          addresses.weth,
          addresses.nct,
          ONE_ETHER
        )
      ).wait();

      // I expect the offsetHelper will have 1 extra NCT in its balance
      const balance = await nct.balanceOf(offsetHelper.address);
      expect(formatEther(balance)).to.be.eql(
        formatEther(initialBalance.add(ONE_ETHER))
      );

      // I expect that the user should have his in-contract balance for NCT to be 1.0
      expect(
        formatEther(await offsetHelper.balances(addr2.address, addresses.nct))
      ).to.be.eql("1.0");
    });

    it("Should swap MATIC for 1.0 NCT", async function () {
      const maticToSend = await offsetHelper.calculateNeededETHAmount(
        addresses.nct,
        ONE_ETHER
      );

      await (
        await offsetHelper["swap(address,uint256)"](addresses.nct, ONE_ETHER, {
          value: maticToSend,
        })
      ).wait();

      const balance = await nct.balanceOf(offsetHelper.address);
      expect(formatEther(balance)).to.be.eql("1.0");
    });

    it("Should send surplus MATIC to user", async function () {
      const preSwapETHBalance = await offsetHelper.provider.getBalance(
        offsetHelper.address
      );

      const maticToSend = await offsetHelper.calculateNeededETHAmount(
        addresses.nct,
        ONE_ETHER
      );

      await (
        await offsetHelper["swap(address,uint256)"](addresses.nct, ONE_ETHER, {
          value: maticToSend.add(parseEther("0.5")),
        })
      ).wait();

      const postSwapETHBalance = await offsetHelper.provider.getBalance(
        offsetHelper.address
      );

      // I'm expecting that the OffsetHelper doesn't have extra MATIC
      // this check is done to ensure any surplus MATIC has been sent to the user, and not to OffsetHelper
      expect(formatEther(preSwapETHBalance)).to.be.eql(
        formatEther(postSwapETHBalance)
      );
    });

    it("Should fail since we have no WETH", async function () {
      await (
        await weth.connect(addrs[0]).approve(offsetHelper.address, ONE_ETHER)
      ).wait();

      await expect(
        offsetHelper
          .connect(addrs[0])
          ["swap(address,address,uint256)"](
            addresses.weth,
            addresses.nct,
            ONE_ETHER
          )
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should swap WETH for 1.0 BCT", async function () {
      const initialBalance = await bct.balanceOf(offsetHelper.address);

      const neededAmount = await offsetHelper.calculateNeededTokenAmount(
        addresses.weth,
        addresses.bct,
        ONE_ETHER
      );

      await (await weth.approve(offsetHelper.address, neededAmount)).wait();

      await (
        await offsetHelper["swap(address,address,uint256)"](
          addresses.weth,
          addresses.bct,
          ONE_ETHER
        )
      ).wait();

      // I expect the offsetHelper will have 1 extra BCT in its balance
      const balance = await bct.balanceOf(offsetHelper.address);
      expect(formatEther(balance)).to.be.eql(
        formatEther(initialBalance.add(ONE_ETHER))
      );

      // I expect that the user should have his in-contract balance for BCT to be 1.0
      expect(
        formatEther(await offsetHelper.balances(addr2.address, addresses.bct))
      ).to.be.eql("1.0");
    });
  });
});
