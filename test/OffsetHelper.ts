import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  formatEther,
  FormatTypes,
  Interface,
  parseEther,
  parseUnits,
} from "ethers/lib/utils";

import * as hardhatContracts from "../utils/toucanContracts.json";
import * as poolContract from "../artifacts/contracts/interfaces/IToucanPoolToken.sol/IToucanPoolToken.json";
import * as carbonOffsetsContract from "../artifacts/contracts/interfaces/IToucanCarbonOffsets.sol/IToucanCarbonOffsets.json";
import {
  IToucanPoolToken,
  OffsetHelper,
  OffsetHelper__factory,
  Swapper,
  Swapper__factory,
} from "../typechain";
import addresses, { whaleAddresses } from "../utils/addresses";
import { Contract } from "ethers";
import { usdcABI, wethABI, wmaticABI } from "../utils/ABIs";

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

    // @ts-ignore
    nct = new ethers.Contract(
      addresses.nct,
      hardhatContracts.contracts.NatureCarbonTonne.abi,
      addr2
    );

    // @ts-ignore
    bct = new ethers.Contract(addresses.bct, poolContract.abi, addr2);
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

    // Transfer a large amount of MATIC and NCT to the test account via account impersonation.
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whaleAddresses.matic],
    });
    const maticWhale = ethers.provider.getSigner(whaleAddresses.matic);
    await maticWhale.sendTransaction({
      to: addr2.address,
      value: (await maticWhale.getBalance()).sub(parseEther("1.0")),
    });

    // Note: The swapper fails when trying to exchange such a large amount of NCT.
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whaleAddresses.nct],
    });
    const addrNctWhale = ethers.provider.getSigner(whaleAddresses.nct);
    const nctWhaleSigner = new ethers.Contract(
      addresses.nct,
      hardhatContracts.contracts.NatureCarbonTonne.abi,
      addrNctWhale
    );
    await nctWhaleSigner.transfer(
      addr2.address,
      await nctWhaleSigner.balanceOf(whaleAddresses.nct)
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
    it("Should retire using a WETH swap and NCT redemption", async function () {
      await (
        await weth.approve(
          offsetHelper.address,
          await offsetHelper.calculateNeededTokenAmount(
            addresses.weth,
            addresses.nct,
            parseEther("1.0")
          )
        )
      ).wait();

      await expect(
        offsetHelper.autoOffsetUsingToken(
          addresses.weth,
          addresses.nct,
          parseEther("1.0")
        )
      ).to.not.be.reverted;
    });

    it("Should retire using a MATIC swap and NCT redemption", async function () {
      const maticToSend = await offsetHelper.calculateNeededETHAmount(
        addresses.nct,
        parseEther("1.0")
      );

      await expect(
        offsetHelper.autoOffsetUsingETH(addresses.nct, parseEther("1.0"), {
          value: maticToSend,
        })
      ).to.not.be.reverted;
    });

    it("Should retire using a NCT deposit and NCT redemption", async function () {
      await (await nct.approve(offsetHelper.address, parseEther("1.0"))).wait();

      await expect(
        offsetHelper.autoOffsetUsingPoolToken(addresses.nct, parseEther("1.0"))
      ).to.not.be.reverted;
    });

    it("Should retire using a WETH swap and BCT redemption", async function () {
      await (
        await weth.approve(
          offsetHelper.address,
          await offsetHelper.calculateNeededTokenAmount(
            addresses.weth,
            addresses.bct,
            parseEther("1.0")
          )
        )
      ).wait();

      await expect(
        offsetHelper.autoOffsetUsingToken(
          addresses.weth,
          addresses.bct,
          parseEther("1.0")
        )
      ).to.not.be.reverted;
    });

    it("Should retire using a USDC swap and NCT redemption", async function () {
      await (
        await usdc.approve(
          offsetHelper.address,
          await offsetHelper.calculateNeededTokenAmount(
            addresses.usdc,
            addresses.nct,
            parseEther("1.0")
          )
        )
      ).wait();

      await expect(
        offsetHelper.autoOffsetUsingToken(
          addresses.usdc,
          addresses.nct,
          parseEther("1.0")
        )
      ).to.not.be.reverted;
    });

    it("Should retire using a WMATIC swap and NCT redemption", async function () {
      await wmatic.deposit({
        value: parseEther("20.0"),
      });

      await (
        await wmatic.approve(
          offsetHelper.address,
          await offsetHelper.calculateNeededTokenAmount(
            addresses.wmatic,
            addresses.nct,
            parseEther("1.0")
          )
        )
      ).wait();

      await expect(
        offsetHelper.autoOffsetUsingToken(
          addresses.wmatic,
          addresses.nct,
          parseEther("1.0")
        )
      ).to.not.be.reverted;
    });
  });

  describe("Testing autoRedeem()", function () {
    it("Should redeem NCT", async function () {
      await (await nct.approve(offsetHelper.address, parseEther("1.0"))).wait();

      await (
        await offsetHelper.deposit(addresses.nct, parseEther("1.0"))
      ).wait();

      await expect(offsetHelper.autoRedeem(addresses.nct, parseEther("1.0"))).to
        .not.be.reverted;
    });

    it("Should fail because we haven't deposited NCT", async function () {
      await expect(
        offsetHelper.autoRedeem(addresses.nct, parseEther("1.0"))
      ).to.be.revertedWith("Insufficient NCT/BCT balance");
    });

    it("Should redeem BCT", async function () {
      // @ts-ignore

      await (await bct.approve(offsetHelper.address, parseEther("1.0"))).wait();

      await (
        await offsetHelper.deposit(addresses.bct, parseEther("1.0"))
      ).wait();

      await expect(offsetHelper.autoRedeem(addresses.bct, parseEther("1.0"))).to
        .not.be.reverted;
    });
  });

  describe("Testing autoRetire()", function () {
    it("Should retire using an NCT deposit", async function () {
      await (await nct.approve(offsetHelper.address, parseEther("1.0"))).wait();

      await (
        await offsetHelper.deposit(addresses.nct, parseEther("1.0"))
      ).wait();

      const redeemReceipt = await (
        await offsetHelper.autoRedeem(addresses.nct, parseEther("1.0"))
      ).wait();

      if (!redeemReceipt.events) {
        return;
      }
      const tco2s =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.tco2s;
      const amounts =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.amounts;

      await expect(offsetHelper.autoRetire(tco2s, amounts)).to.not.be.reverted;
    });

    it("Should fail because we haven't redeemed any TCO2", async function () {
      await expect(
        offsetHelper.autoRetire(
          ["0xb139C4cC9D20A3618E9a2268D73Eff18C496B991"],
          [parseEther("1.0")]
        )
      ).to.be.revertedWith("Insufficient TCO2 balance");
    });

    it("Should retire using a BCT deposit", async function () {
      await (await bct.approve(offsetHelper.address, parseEther("1.0"))).wait();

      await (
        await offsetHelper.deposit(addresses.bct, parseEther("1.0"))
      ).wait();

      const redeemReceipt = await (
        await offsetHelper.autoRedeem(addresses.bct, parseEther("1.0"))
      ).wait();

      if (!redeemReceipt.events) {
        return;
      }
      const tco2s =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.tco2s;
      const amounts =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.amounts;

      await expect(offsetHelper.autoRetire(tco2s, amounts)).to.not.be.reverted;
    });

    it("Should retire using an NCT deposit, even if the first scored TCO2 is not in pool", async function () {
      const scoredTCO2s = await nct.getScoredTCO2s();
      const lowestScoredTCO2 = new ethers.Contract(
        scoredTCO2s[0],
        carbonOffsetsContract.abi,
        addr2
      );
      const lowestScoredTCO2Balance = await lowestScoredTCO2.balanceOf(
        addresses.nct
      );

      // Skip setup if the oldest tco2's balance in the pool is already 0.
      if (formatEther(lowestScoredTCO2Balance) !== "0.0") {
        // Setup: If the oldest tco2 balance is non-zero, remove all its tokens from the pool via a redeem.
        // Ensure that addr2 has enough NCT to redeem all of the lowestScoredTCO2 or setup will fail.
        expect(await nct.balanceOf(addr2.address)).to.be.above(
          await lowestScoredTCO2.balanceOf(addresses.nct)
        );

        await nct.approve(offsetHelper.address, lowestScoredTCO2Balance);

        await offsetHelper.deposit(addresses.nct, lowestScoredTCO2Balance);

        await offsetHelper.autoRedeem(addresses.nct, lowestScoredTCO2Balance);
      }

      // Ensure the test condition is met.
      expect(await lowestScoredTCO2.balanceOf(addresses.nct)).to.equal(0);

      await nct.approve(offsetHelper.address, parseEther("1.0"));

      await offsetHelper.deposit(addresses.nct, parseEther("0.0005"));

      const redeemReceipt = await (
        await offsetHelper.autoRedeem(addresses.nct, parseEther("0.0005"))
      ).wait();

      if (!redeemReceipt.events) {
        return;
      }
      const tco2s =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.tco2s;
      const amounts =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.amounts;

      await expect(offsetHelper.autoRetire(tco2s, amounts)).to.not.be.reverted;
    });
  });

  describe("Testing deposit() and withdraw()", function () {
    it("Should deposit 1.0 NCT", async function () {
      await (await nct.approve(offsetHelper.address, parseEther("1.0"))).wait();

      await (
        await offsetHelper.deposit(addresses.nct, parseEther("1.0"))
      ).wait();

      expect(
        formatEther(await offsetHelper.balances(addr2.address, addresses.nct))
      ).to.be.eql("1.0");
    });

    it("Should fail to deposit because we have no NCT", async function () {
      await (
        await nct
          .connect(addrs[0])
          .approve(offsetHelper.address, parseEther("1.0"))
      ).wait();

      await expect(
        offsetHelper.connect(addrs[0]).deposit(addresses.nct, parseEther("1.0"))
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should deposit and withdraw 1.0 NCT", async function () {
      const preDepositNCTBalance = await nct.balanceOf(addr2.address);

      await (await nct.approve(offsetHelper.address, parseEther("1.0"))).wait();

      await (
        await offsetHelper.deposit(addresses.nct, parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper.withdraw(addresses.nct, parseEther("1.0"))
      ).wait();

      const postWithdrawNCTBalance = await nct.balanceOf(addr2.address);

      expect(formatEther(postWithdrawNCTBalance)).to.be.eql(
        formatEther(preDepositNCTBalance)
      );
    });

    it("Should fail to withdraw because we haven't deposited enough NCT", async function () {
      await (await nct.approve(offsetHelper.address, parseEther("1.0"))).wait();

      await (
        await offsetHelper.deposit(addresses.nct, parseEther("1.0"))
      ).wait();

      await expect(
        offsetHelper.withdraw(addresses.nct, parseEther("2.0"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should deposit 1.0 BCT", async function () {
      await (await bct.approve(offsetHelper.address, parseEther("1.0"))).wait();

      await (
        await offsetHelper.deposit(addresses.bct, parseEther("1.0"))
      ).wait();

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
            parseEther("1.0")
          )
        )
      ).wait();

      await (
        await offsetHelper["swap(address,address,uint256)"](
          addresses.weth,
          addresses.nct,
          parseEther("1.0")
        )
      ).wait();

      // I expect the offsetHelper will have 1 extra NCT in its balance
      const balance = await nct.balanceOf(offsetHelper.address);
      expect(formatEther(balance)).to.be.eql(
        formatEther(initialBalance.add(parseEther("1.0")))
      );

      // I expect that the user should have his in-contract balance for NCT to be 1.0
      expect(
        formatEther(await offsetHelper.balances(addr2.address, addresses.nct))
      ).to.be.eql("1.0");
    });

    it("Should swap MATIC for 1.0 NCT", async function () {
      const maticToSend = await offsetHelper.calculateNeededETHAmount(
        addresses.nct,
        parseEther("1.0")
      );

      await (
        await offsetHelper["swap(address,uint256)"](
          addresses.nct,
          parseEther("1.0"),
          {
            value: maticToSend,
          }
        )
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
        parseEther("1.0")
      );

      await (
        await offsetHelper["swap(address,uint256)"](
          addresses.nct,
          parseEther("1.0"),
          {
            value: maticToSend.add(parseEther("0.5")),
          }
        )
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
        await weth
          .connect(addrs[0])
          .approve(offsetHelper.address, parseEther("1.0"))
      ).wait();

      await expect(
        offsetHelper
          .connect(addrs[0])
          ["swap(address,address,uint256)"](
            addresses.weth,
            addresses.nct,
            parseEther("1.0")
          )
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should swap WETH for 1.0 BCT", async function () {
      const initialBalance = await bct.balanceOf(offsetHelper.address);

      const neededAmount = await offsetHelper.calculateNeededTokenAmount(
        addresses.weth,
        addresses.bct,
        parseEther("1.0")
      );

      await (await weth.approve(offsetHelper.address, neededAmount)).wait();

      await (
        await offsetHelper["swap(address,address,uint256)"](
          addresses.weth,
          addresses.bct,
          parseEther("1.0")
        )
      ).wait();

      // I expect the offsetHelper will have 1 extra BCT in its balance
      const balance = await bct.balanceOf(offsetHelper.address);
      expect(formatEther(balance)).to.be.eql(
        formatEther(initialBalance.add(parseEther("1.0")))
      );

      // I expect that the user should have his in-contract balance for BCT to be 1.0
      expect(
        formatEther(await offsetHelper.balances(addr2.address, addresses.bct))
      ).to.be.eql("1.0");
    });
  });
});
