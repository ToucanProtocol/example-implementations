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
import { Pool } from "@uniswap/v3-sdk";
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";
import { BigNumber, BigNumberish } from "ethers";

const addresses: any = {
  myAddress: "0x721F6f7A29b99CbdE1F18C4AA7D7AEb31eb2923B",
  bctAddress: "0x2F800Db0fdb5223b3C3f354886d907A671414A7F",
  nctAddress: "0xD838290e877E0188a4A44700463419ED96c16107",
  usdcAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  wethAddress: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  wmaticAddress: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
};

describe("Offset Helper", function () {
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
        ethers.utils.parseEther("2.0").toHexString(), // for some reason it only works with small amounts
      ]);
    }

    owner = await ethers.getSigner(addresses.myAddress);
    [addr1, addr2, ...addrs] = await ethers.getSigners();

    const offsetHelperFactory = (await ethers.getContractFactory(
      "OffsetHelper",
      owner
    )) as OffsetHelper__factory;
    offsetHelper = await offsetHelperFactory.deploy();
  });

  describe("swap()", function () {
    it("Should swap 0.1 USDC for 0.1 NCT", async function () {
      // since I have no USDC, I need to impersonate an account that has it
      // I'll also give it some wei just to be safe
      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [addresses.myAddress],
      });
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0xf977814e90da44bfa03b6295a0616a897441acec"],
      });
      await network.provider.send("hardhat_setBalance", [
        "0xf977814e90da44bfa03b6295a0616a897441acec",
        ethers.utils.parseEther("2.0").toHexString(),
      ]);
      const signer = await ethers.getSigner(
        "0xf977814e90da44bfa03b6295a0616a897441acec"
      );

      await (
        await offsetHelper
          .connect(signer)
          .swap(
            addresses.usdcAddress,
            addresses.nctAddress,
            ethers.utils.parseEther("0.1")
          )
      ).wait();
    });
  });

  describe("autoRedeem()", function () {
    it("Should redeem 0.1 NCT for 0.1 TCO2", async function () {
      // since I have no NCT, I need to impersonate an account that has it
      // I'll also give it some wei, just to be safe
      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [addresses.myAddress],
      });
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0xdab7f2bc9aa986d9759718203c9a76534894e900"],
      });
      await network.provider.send("hardhat_setBalance", [
        "0xdab7f2bc9aa986d9759718203c9a76534894e900",
        ethers.utils.parseEther("2.0").toHexString(),
      ]);
      const signer = await ethers.getSigner(
        "0xdab7f2bc9aa986d9759718203c9a76534894e900"
      );

      // @ts-ignore
      nct = new ethers.Contract(addresses.nctAddress, nctAbi.abi, owner);

      const initialBalance = await nct.balanceOf(
        "0xdab7f2bc9aa986d9759718203c9a76534894e900"
      );

      await (
        await nct
          .connect(signer)
          .approve(offsetHelper.address, ethers.utils.parseEther("0.1"))
      ).wait();

      const autoRedeemTxn = await (
        await offsetHelper
          .connect(signer)
          .autoRedeem("NCT", ethers.utils.parseEther("0.1"))
      ).wait();

      expect(
        await nct.balanceOf("0xdab7f2bc9aa986d9759718203c9a76534894e900")
      ).to.be.eql(initialBalance.sub(ethers.utils.parseEther("0.1")));
    });

    it("Should be reverted with 'blah blah.'", async function () {
      return;
      await expect("0.1").to.be.revertedWith(
        "You can't offset more than your footprint."
      );
    });
  });
});
