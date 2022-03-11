import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import * as tcoAbi from "../artifacts/contracts/CO2KEN_contracts/ToucanCarbonOffsets.sol/ToucanCarbonOffsets.json";
import * as bctAbi from "../artifacts/contracts/CO2KEN_contracts/pools/BaseCarbonTonne.sol/BaseCarbonTonne.json";
import * as nctAbi from "../artifacts/contracts/CO2KEN_contracts/pools/NCT.sol/NatureCarbonTonne.json";
import {
  BaseCarbonTonne,
  NatureCarbonTonne,
  OffsetHelper,
  OffsetHelper__factory,
  ToucanCarbonOffsets,
} from "../typechain";
import {
  formatEther,
  FormatTypes,
  Interface,
  parseEther,
} from "ethers/lib/utils";
import { BigNumber } from "ethers";
import addresses from "../utils/addresses";
import getTotalTCO2sHeld from "../utils/getTotalTCO2sHeld";
import impersonateAccount from "../utils/impersonateAccount";

describe("Offset Helper - autoRetire", function () {
  let offsetHelper: OffsetHelper;
  let tco: ToucanCarbonOffsets;
  let bct: BaseCarbonTonne;
  let nct: NatureCarbonTonne;
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

  describe("autoRetire()", function () {
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
      nct = new ethers.Contract(addresses.nct, nctAbi.abi, owner);

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
      nct = new ethers.Contract(addresses.nct, nctAbi.abi, owner);

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
});
