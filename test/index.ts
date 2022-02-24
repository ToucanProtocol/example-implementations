import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import * as tcoAbi from "../artifacts/contracts/CO2KEN_contracts/ToucanCarbonOffsets.sol/ToucanCarbonOffsets.json";
import * as bctAbi from "../artifacts/contracts/CO2KEN_contracts/pools/BaseCarbonTonne.sol/BaseCarbonTonne.json";
import * as nctAbi from "../artifacts/contracts/CO2KEN_contracts/pools/NCT.sol/NCT.json";

const tco2Address: string = "0xa5831eb637dff307395b5183c86B04c69C518681";
const myAddress: string = "0x721F6f7A29b99CbdE1F18C4AA7D7AEb31eb2923B";
const bctAddress: string = "0xf2438A14f668b1bbA53408346288f3d7C71c10a1";

describe("Offset Helper", function () {
  let offsetHelper: OffsetHelper;
  let tco: ToucanCarbonOffsets;
  let bct: BaseCarbonTonne;
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
        params: [myAddress],
      });
    }

    // we get a signer based on my above address (I have TCO2, BCT & MATIC on it at the blockNumber I chose)
    owner = await ethers.getSigner(myAddress);
    // and we get a bunch of other random signers
    [addr1, addr2, ...addrs] = await ethers.getSigners();

    // we deploy a DEX contract and get a portal to it
    const copFactory = (await ethers.getContractFactory(
      "ContractOffsetterPOC",
      owner
      // eslint-disable-next-line camelcase
    )) as OffsetHelper__factory;
    offsetHelper = await copFactory.deploy();

    // we instantiate a portal to my TCO2 contract
    // @ts-ignore
    tco = new ethers.Contract(tco2Address, tcoAbi.abi, owner);

    // we instantiate a portal to BCT
    // @ts-ignore
    bct = new ethers.Contract(bctAddress, bctAbi.abi, owner);
  });

  describe("swap()", function () {
    it("Should blah blah", async function () {
      // example
      expect("1.0").to.be.eql("0.00000152");
    });

    it("Should be reverted with 'blah blah.'", async function () {
      // example
      await expect("1.0").to.be.revertedWith(
        "You can't offset more than your footprint."
      );
    });
  });
});
