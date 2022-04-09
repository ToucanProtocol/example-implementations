import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import * as hardhatContracts from "../utils/toucanContracts.json";
import * as poolContract from "../artifacts/contracts/interfaces/IToucanPoolToken.sol/IToucanPoolToken.json";
import {
  IToucanCarbonOffsets,
  IToucanPoolToken,
  OffsetHelper,
  OffsetHelper__factory,
} from "../typechain";
import { formatEther, parseEther } from "ethers/lib/utils";
import addresses from "../utils/addresses";
import getTotalTCO2sHeld from "../utils/getTotalTCO2sHeld";
import impersonateAccount from "../utils/impersonateAccount";

describe("Offset Helper - autoRetire", function () {
  let offsetHelper: OffsetHelper;
  let tco: IToucanCarbonOffsets;
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

  describe("autoRetire() using NCT", function () {
    it("User's in-contract TCO2 balance should be 0.0 - manual offset", async function () {
      // since I have no NCT, I need to impersonate an account that has it
      // I'll also give it some wei, just to be safe
      const addressToImpersonate = "0xdab7f2bc9aa986d9759718203c9a76534894e900";
      const signer = await impersonateAccount(
        addresses.myAddress,
        addressToImpersonate
      );
      await network.provider.send("hardhat_setBalance", [
        addressToImpersonate,
        parseEther("2.0").toHexString(),
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

      await (
        await offsetHelper
          .connect(signer)
          .autoRedeem(addresses.nct, parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper
          .connect(signer)
          .autoRetire(parseEther("1.0"), addresses.nct)
      ).wait();

      // I expect the user's in-contract TCO2 balance to be 0.0
      expect(
        formatEther(
          await offsetHelper.tco2Balance(
            "0xdab7f2bc9aa986d9759718203c9a76534894e900"
          )
        )
      ).to.be.eql("0.0");
    });

    it("OffsetHelpers's TCO2 balances should be 0.0 - manual offset", async function () {
      // since I have no NCT, I need to impersonate an account that has it
      // I'll also give it some wei, just to be safe
      const addressToImpersonate = "0xdab7f2bc9aa986d9759718203c9a76534894e900";
      const signer = await impersonateAccount(
        addresses.myAddress,
        addressToImpersonate
      );
      await network.provider.send("hardhat_setBalance", [
        addressToImpersonate,
        parseEther("2.0").toHexString(),
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

      await (
        await offsetHelper
          .connect(signer)
          .autoRedeem(addresses.nct, parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper
          .connect(signer)
          .autoRetire(parseEther("1.0"), addresses.nct)
      ).wait();

      const totalTCO2sHeld = await getTotalTCO2sHeld(nct, offsetHelper, owner);

      expect(formatEther(totalTCO2sHeld)).to.be.eql("0.0");
    });

    it("Should fail cause I don't have enough TCO2 in-contract", async function () {
      await expect(
        offsetHelper.autoRetire(parseEther("1.0"), addresses.nct)
      ).to.be.revertedWith("You don't have enough TCO2 in this contract.");
    });
  });

  describe("autoRetire() using BCT", async function () {
    it("User's in-contract TCO2 balance should be 0.0 - manual offset, using BCT", async function () {
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

      await (
        await offsetHelper
          .connect(signer)
          .autoRedeem(addresses.bct, parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper
          .connect(signer)
          .autoRetire(parseEther("1.0"), addresses.bct)
      ).wait();

      // I expect the user's in-contract TCO2 balance to be 0.0
      expect(
        formatEther(
          await offsetHelper.tco2Balance(
            "0xCef2D0c7d89C3Dcc7a8E8AF561b0294BCD6e9EBD"
          )
        )
      ).to.be.eql("0.0");
    });

    it("OffsetHelpers's TCO2 balances should be 0.0 - manual offset, using BCT", async function () {
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

      await (
        await offsetHelper
          .connect(signer)
          .autoRedeem(addresses.bct, parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper
          .connect(signer)
          .autoRetire(parseEther("1.0"), addresses.bct)
      ).wait();

      const totalTCO2sHeld = await getTotalTCO2sHeld(bct, offsetHelper, owner);

      expect(formatEther(totalTCO2sHeld)).to.be.eql("0.0");
    });
  });
});
