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

describe("Offset Helper - Others", function () {
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

  describe("deposit() and withdraw()", function () {
    it("Should deposit 1.0 NCT", async function () {
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

      expect(
        formatEther(
          await offsetHelper.balances(
            "0xdab7f2bc9aa986d9759718203c9a76534894e900",
            addresses.nct
          )
        )
      ).to.be.eql("1.0");
    });

    it("Should deposit and withdraw 1.0 NCT", async function () {
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

      const preDepositNCTBalance = await nct.balanceOf(signer.address);

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
          .withdraw(addresses.nct, parseEther("1.0"))
      ).wait();

      const postWithdrawNCTBalance = await nct.balanceOf(signer.address);

      expect(formatEther(postWithdrawNCTBalance)).to.be.eql(
        formatEther(preDepositNCTBalance)
      );
    });
  });
});
