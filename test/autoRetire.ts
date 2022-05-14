import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { formatEther, parseEther } from "ethers/lib/utils";

import * as hardhatContracts from "../utils/toucanContracts.json";
import * as poolContract from "../artifacts/contracts/interfaces/IToucanPoolToken.sol/IToucanPoolToken.json";
import {
  IToucanPoolToken,
  OffsetHelper,
  OffsetHelper__factory,
} from "../typechain";
import addresses from "../utils/addresses";
import getTotalTCO2sHeld from "../utils/getTotalTCO2sHeld";
import impersonateAccount from "../utils/impersonateAccount";

describe("Offset Helper - autoRetire", function () {
  let offsetHelper: OffsetHelper;
  let bct: IToucanPoolToken;
  let nct: IToucanPoolToken;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addrs: SignerWithAddress[];

  beforeEach(async function () {
    /**
     * if we are forking we impersonate my account and give me some wei
     */
    if (network.name === "hardhat") {
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [addresses.myAddress],
      });
      await network.provider.send("hardhat_setBalance", [
        addresses.myAddress,
        parseEther("8.0").toHexString(), // for some reason it only works with small amounts
      ]);
    }

    owner = await ethers.getSigner(addresses.myAddress);
    [addr1, addr2, ...addrs] = await ethers.getSigners();

    const offsetHelperFactory = (await ethers.getContractFactory(
      "OffsetHelper",
      owner
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
  });

  describe("Testing autoRetire()", function () {
    it("Should retire using an NCT deposit", async function () {
      // since I have no NCT, I need to impersonate an account that has it
      // I'll also give it some wei, just to be safe
      const addressToImpersonate = "0xdab7f2bc9aa986d9759718203c9a76534894e900";
      const signer = await impersonateAccount(
        addresses.myAddress,
        addressToImpersonate
      );
      await network.provider.send("hardhat_setBalance", [
        addressToImpersonate,
        parseEther("8.0").toHexString(),
      ]);

      // @ts-ignore
      nct = new ethers.Contract(
        addresses.nct,
        hardhatContracts.contracts.NatureCarbonTonne.abi,
        owner
      );

      await (
        await nct
          .connect(signer)
          .approve(offsetHelper.address, parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper
          .connect(signer)
          .deposit(addresses.nct, parseEther("1.0"))
      ).wait();

      const redeemReceipt = await (
        await offsetHelper
          .connect(signer)
          .autoRedeem(addresses.nct, parseEther("1.0"))
      ).wait();

      if (!redeemReceipt.events) {
        return;
      }
      const tco2s =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.tco2s;
      const amounts =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.amounts;

      await expect(offsetHelper.connect(signer).autoRetire(tco2s, amounts)).to
        .not.be.reverted;
    });

    it("Should fail because we haven't redeemed any TCO2", async function () {
      await expect(
        offsetHelper.autoRetire(
          ["0xb139C4cC9D20A3618E9a2268D73Eff18C496B991"],
          [parseEther("1.0")]
        )
      ).to.be.revertedWith("You don't have enough of this TCO2");
    });

    it("Should retire using an NCT deposit", async function () {
      // since I have no BCT, I need to impersonate an account that has it
      // I'll also give it some wei, just to be safe
      const addressToImpersonate = "0xCef2D0c7d89C3Dcc7a8E8AF561b0294BCD6e9EBD";
      const signer = await impersonateAccount(
        addresses.myAddress,
        addressToImpersonate
      );
      await network.provider.send("hardhat_setBalance", [
        addressToImpersonate,
        parseEther("2.0").toHexString(),
      ]);

      // @ts-ignore
      bct = new ethers.Contract(addresses.bct, poolContract.abi, owner);

      await (
        await bct
          .connect(signer)
          .approve(offsetHelper.address, parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper
          .connect(signer)
          .deposit(addresses.bct, parseEther("1.0"))
      ).wait();

      const redeemReceipt = await (
        await offsetHelper
          .connect(signer)
          .autoRedeem(addresses.bct, parseEther("1.0"))
      ).wait();

      if (!redeemReceipt.events) {
        return;
      }
      const tco2s =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.tco2s;
      const amounts =
        redeemReceipt.events[redeemReceipt.events.length - 1].args?.amounts;

      await expect(offsetHelper.connect(signer).autoRetire(tco2s, amounts)).to
        .not.be.reverted;
    });
  });
});
