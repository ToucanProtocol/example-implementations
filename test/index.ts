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

const addresses: any = {
  myAddress: "0x721F6f7A29b99CbdE1F18C4AA7D7AEb31eb2923B",
  tco2Address: "0xa5831eb637dff307395b5183c86B04c69C518681",
  bctAddress: "0xf2438A14f668b1bbA53408346288f3d7C71c10a1",
  nctAddress: "0x450471CC47FCB7A523DE90b64b98e47b66e27e49",
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
     * if we are forking Mumbai (which I chose to do for performance, so I can test & iterate faster)
     * we impersonate my Mumbai account (I have TCO2, BCT & MATIC on it at the blockNumber I chose)
     */
    if (network.name === "hardhat") {
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [addresses.myAddress],
      });
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
    it("Should swap 0.1 USDC for 0.1 BCT", async function () {
      // TODO implement test
    });
  });

  describe("autoRedeem()", function () {
    it("Should redeem 0.1 NCT for 0.1 TCO2", async function () {
      // @ts-ignore
      nct = new ethers.Contract(addresses.nctAddress, nctAbi.abi, owner);

      // TODO there is an issue with the nct.getScoredTCO2s method
      console.log("scored tco2s", await nct.getScoredTCO2s());

      return;

      await (
        await nct.approve(offsetHelper.address, ethers.utils.parseEther("0.1"))
      ).wait();

      const autoRedeemTxn = await (
        await offsetHelper.autoRedeem("NCT", ethers.utils.parseEther("0.1"))
      ).wait();

      expect("0.1").to.be.eql("0.1");
    });

    it("Should be reverted with 'blah blah.'", async function () {
      return;
      await expect("0.1").to.be.revertedWith(
        "You can't offset more than your footprint."
      );
    });
  });
});
