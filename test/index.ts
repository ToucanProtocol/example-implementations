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
import { FormatTypes, Interface } from "ethers/lib/utils";

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
        ethers.utils.parseEther("8.0").toHexString(), // for some reason it only works with small amounts
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
    it("Should swap WETH for 1.0 NCT", async function () {
      // since I have no WETH, I need to impersonate an account that has it
      // I'll also give it some wei just to be safe
      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [addresses.myAddress],
      });
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0xdc9232e2df177d7a12fdff6ecbab114e2231198d"],
      });
      await network.provider.send("hardhat_setBalance", [
        "0xdc9232e2df177d7a12fdff6ecbab114e2231198d",
        ethers.utils.parseEther("2.0").toHexString(),
      ]);
      const signer = await ethers.getSigner(
        "0xdc9232e2df177d7a12fdff6ecbab114e2231198d"
      );

      // @ts-ignore
      nct = new ethers.Contract(addresses.nctAddress, nctAbi.abi, owner);

      const initialBalance = await nct.balanceOf(
        "0xdc9232e2df177d7a12fdff6ecbab114e2231198d"
      );

      const iface = new Interface(
        '[{"inputs":[{"internalType":"address","name":"childChainManager","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"userAddress","type":"address"},{"indexed":false,"internalType":"address payable","name":"relayerAddress","type":"address"},{"indexed":false,"internalType":"bytes","name":"functionSignature","type":"bytes"}],"name":"MetaTransactionExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"CHILD_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"CHILD_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEPOSITOR_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ERC712_VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"bytes","name":"depositData","type":"bytes"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"userAddress","type":"address"},{"internalType":"bytes","name":"functionSignature","type":"bytes"},{"internalType":"bytes32","name":"sigR","type":"bytes32"},{"internalType":"bytes32","name":"sigS","type":"bytes32"},{"internalType":"uint8","name":"sigV","type":"uint8"}],"name":"executeMetaTransaction","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"getChainId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getDomainSeperator","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getNonce","outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
      );
      iface.format(FormatTypes.full);

      const weth = new ethers.Contract(addresses.wethAddress, iface, owner);

      await (
        await weth
          .connect(signer)
          .approve(offsetHelper.address, ethers.utils.parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper
          .connect(signer)
          ["swap(address,address,uint256)"](
            addresses.wethAddress,
            addresses.nctAddress,
            ethers.utils.parseEther("1.0")
          )
      ).wait();

      const balance = await nct.balanceOf(
        "0xdc9232e2df177d7a12fdff6ecbab114e2231198d"
      );
      expect(ethers.utils.formatEther(balance)).to.be.eql(
        ethers.utils.formatEther(
          initialBalance.add(ethers.utils.parseEther("1.0"))
        )
      );
    });

    it("Should swap MATIC for 1.0 NCT", async function () {
      // TODO for some reason it's failing to send back unused MATIC
      // also, the swap method may send unused MATIC to OffsetHelper instead of to the user
      await (
        await offsetHelper["swap(address,uint256)"](
          addresses.nctAddress,
          ethers.utils.parseEther("1.0"),
          {
            value: ethers.utils.parseEther("5.0"),
          }
        )
      ).wait();

      // @ts-ignore
      nct = new ethers.Contract(addresses.nctAddress, nctAbi.abi, owner);

      const balance = await nct.balanceOf(addresses.myAddress);
      expect(ethers.utils.formatEther(balance)).to.be.eql("1.0");
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

      await (
        await offsetHelper
          .connect(signer)
          .autoRedeem(addresses.nctAddress, ethers.utils.parseEther("0.1"))
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

  describe("autoRetire()", function () {
    it("Should retire 1 TCO2", async function () {
      // I will impersonate an account that has NCT. I'll also give it some wei, just to be safe
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
          .approve(offsetHelper.address, ethers.utils.parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper
          .connect(signer)
          .autoRedeem(addresses.nctAddress, ethers.utils.parseEther("1.0"))
      ).wait();

      expect(
        await nct.balanceOf("0xdab7f2bc9aa986d9759718203c9a76534894e900")
      ).to.be.eql(initialBalance.sub(ethers.utils.parseEther("1.0")));

      // TODO the problem is I need to approve the contract from the TCO contract like this
      // tco2xyz.approve(externalOffsetterContract, 100)
      // but how do I do that when I don't know what TCO2 the user has since I used autoRedeem
      await (
        await offsetHelper
          .connect(signer)
          .autoRetire(ethers.utils.parseEther("1.0"), addresses.nctAddress)
      ).wait();

      // TODO test supply of TCO2
    });
  });
});
