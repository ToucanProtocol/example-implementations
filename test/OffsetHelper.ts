import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  formatEther,
  FormatTypes,
  Interface,
  parseEther,
} from "ethers/lib/utils";

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

describe("Offset Helper - autoOffset", function () {
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

  describe("Testing autoOffset()", function () {
    it("Should retire using a WETH swap and NCT redemption", async function () {
      // since I have no WETH, I need to impersonate an account that has it
      // I'll also give it some wei just to be safe
      const addressToImpersonate = "0xdc9232e2df177d7a12fdff6ecbab114e2231198d";
      const signer = await impersonateAccount(
        addresses.myAddress,
        addressToImpersonate
      );
      await network.provider.send("hardhat_setBalance", [
        addressToImpersonate,
        parseEther("2.0").toHexString(),
      ]);

      const iface = new Interface(
        '[{"inputs":[{"internalType":"address","name":"childChainManager","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"userAddress","type":"address"},{"indexed":false,"internalType":"address payable","name":"relayerAddress","type":"address"},{"indexed":false,"internalType":"bytes","name":"functionSignature","type":"bytes"}],"name":"MetaTransactionExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"CHILD_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"CHILD_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEPOSITOR_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ERC712_VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"bytes","name":"depositData","type":"bytes"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"userAddress","type":"address"},{"internalType":"bytes","name":"functionSignature","type":"bytes"},{"internalType":"bytes32","name":"sigR","type":"bytes32"},{"internalType":"bytes32","name":"sigS","type":"bytes32"},{"internalType":"uint8","name":"sigV","type":"uint8"}],"name":"executeMetaTransaction","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"getChainId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getDomainSeperator","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getNonce","outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
      );
      iface.format(FormatTypes.full);

      const weth = new ethers.Contract(addresses.weth, iface, owner);

      await (
        await weth
          .connect(signer)
          .approve(offsetHelper.address, parseEther("1.0"))
      ).wait();

      await expect(
        offsetHelper
          .connect(signer)
          .autoOffsetUsingToken(
            addresses.weth,
            addresses.nct,
            parseEther("1.0")
          )
      ).to.not.be.reverted;
    });

    it("Should retire using a MATIC swap and NCT redemption", async function () {
      const maticToSend = await offsetHelper.howMuchETHShouldISendToSwap(
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

      await expect(
        offsetHelper
          .connect(signer)
          .autoOffsetUsingPoolToken(addresses.nct, parseEther("1.0"))
      ).to.not.be.reverted;
    });

    it("Should retire using a WETH swap and BCT redemption", async function () {
      // since I have no WETH, I need to impersonate an account that has it
      // I'll also give it some wei just to be safe
      const addressToImpersonate = "0xdc9232e2df177d7a12fdff6ecbab114e2231198d";
      const signer = await impersonateAccount(
        addresses.myAddress,
        addressToImpersonate
      );
      await network.provider.send("hardhat_setBalance", [
        addressToImpersonate,
        parseEther("2.0").toHexString(),
      ]);

      const iface = new Interface(
        '[{"inputs":[{"internalType":"address","name":"childChainManager","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"userAddress","type":"address"},{"indexed":false,"internalType":"address payable","name":"relayerAddress","type":"address"},{"indexed":false,"internalType":"bytes","name":"functionSignature","type":"bytes"}],"name":"MetaTransactionExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"CHILD_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"CHILD_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEPOSITOR_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ERC712_VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"bytes","name":"depositData","type":"bytes"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"userAddress","type":"address"},{"internalType":"bytes","name":"functionSignature","type":"bytes"},{"internalType":"bytes32","name":"sigR","type":"bytes32"},{"internalType":"bytes32","name":"sigS","type":"bytes32"},{"internalType":"uint8","name":"sigV","type":"uint8"}],"name":"executeMetaTransaction","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"getChainId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getDomainSeperator","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getNonce","outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
      );
      iface.format(FormatTypes.full);

      const weth = new ethers.Contract(addresses.weth, iface, owner);

      await (
        await weth
          .connect(signer)
          .approve(offsetHelper.address, parseEther("1.0"))
      ).wait();

      await expect(
        offsetHelper
          .connect(signer)
          .autoOffsetUsingToken(
            addresses.weth,
            addresses.bct,
            parseEther("1.0")
          )
      ).to.not.be.reverted;
    });
  });

  describe("Testing autoRedeem()", function () {
    it("Should redeem NCT", async function () {
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

      await expect(
        offsetHelper
          .connect(signer)
          .autoRedeem(addresses.nct, parseEther("1.0"))
      ).to.not.be.reverted;
    });

    it("Should fail because we haven't deposited NCT", async function () {
      await expect(
        offsetHelper.autoRedeem(addresses.nct, parseEther("1.0"))
      ).to.be.revertedWith("You haven't deposited enough NCT / BCT");
    });

    it("Should redeem BCT", async function () {
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

      await expect(
        offsetHelper
          .connect(signer)
          .autoRedeem(addresses.bct, parseEther("1.0"))
      ).to.not.be.reverted;
    });
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

  describe("Testing deposit() and withdraw()", function () {
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

      expect(
        formatEther(
          await offsetHelper.balances(
            "0xdab7f2bc9aa986d9759718203c9a76534894e900",
            addresses.nct
          )
        )
      ).to.be.eql("1.0");
    });

    it("Should fail to deposit because we have no NCT", async function () {
      // @ts-ignore
      nct = new ethers.Contract(
        addresses.nct,
        hardhatContracts.contracts.NatureCarbonTonne.abi,
        owner
      );

      await (await nct.approve(offsetHelper.address, parseEther("1.0"))).wait();

      await expect(
        offsetHelper.deposit(addresses.nct, parseEther("1.0"))
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
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
      nct = new ethers.Contract(
        addresses.nct,
        hardhatContracts.contracts.NatureCarbonTonne.abi,
        owner
      );

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

    it("Should fail to withdraw because we haven't deposited enough NCT", async function () {
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

      await expect(
        offsetHelper.connect(signer).withdraw(addresses.nct, parseEther("2.0"))
      ).to.be.revertedWith("You don't have enough to withdraw.");
    });

    it("Should deposit 1.0 BCT", async function () {
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

      expect(
        formatEther(
          await offsetHelper.balances(
            "0xCef2D0c7d89C3Dcc7a8E8AF561b0294BCD6e9EBD",
            addresses.bct
          )
        )
      ).to.be.eql("1.0");
    });
  });

  describe("swap() for NCT", function () {
    it("Should swap WETH for 1.0 NCT", async function () {
      // since I have no WETH, I need to impersonate an account that has it
      // I'll also give it some wei just to be safe
      const addressToImpersonate = "0xdc9232e2df177d7a12fdff6ecbab114e2231198d";
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

      const initialBalance = await nct.balanceOf(offsetHelper.address);

      const iface = new Interface(
        '[{"inputs":[{"internalType":"address","name":"childChainManager","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"userAddress","type":"address"},{"indexed":false,"internalType":"address payable","name":"relayerAddress","type":"address"},{"indexed":false,"internalType":"bytes","name":"functionSignature","type":"bytes"}],"name":"MetaTransactionExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"CHILD_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"CHILD_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEPOSITOR_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ERC712_VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"bytes","name":"depositData","type":"bytes"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"userAddress","type":"address"},{"internalType":"bytes","name":"functionSignature","type":"bytes"},{"internalType":"bytes32","name":"sigR","type":"bytes32"},{"internalType":"bytes32","name":"sigS","type":"bytes32"},{"internalType":"uint8","name":"sigV","type":"uint8"}],"name":"executeMetaTransaction","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"getChainId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getDomainSeperator","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getNonce","outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
      );
      iface.format(FormatTypes.full);

      const weth = new ethers.Contract(addresses.weth, iface, owner);

      await (
        await weth
          .connect(signer)
          .approve(offsetHelper.address, parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper
          .connect(signer)
          ["swap(address,address,uint256)"](
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
        formatEther(
          await offsetHelper.balances(
            "0xdc9232e2df177d7a12fdff6ecbab114e2231198d",
            addresses.nct
          )
        )
      ).to.be.eql("1.0");
    });

    it("Should swap MATIC for 1.0 NCT", async function () {
      const maticToSend = await offsetHelper.howMuchETHShouldISendToSwap(
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

      // @ts-ignore
      nct = new ethers.Contract(
        addresses.nct,
        hardhatContracts.contracts.NatureCarbonTonne.abi,
        owner
      );

      const balance = await nct.balanceOf(offsetHelper.address);
      expect(formatEther(balance)).to.be.eql("1.0");
    });

    it("Should send surplus MATIC to user", async function () {
      const preSwapETHBalance = await offsetHelper.provider.getBalance(
        offsetHelper.address
      );

      await (
        await offsetHelper["swap(address,uint256)"](
          addresses.nct,
          parseEther("1.0"),
          {
            value: parseEther("5.0"),
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
      // @ts-ignore
      nct = new ethers.Contract(
        addresses.nct,
        hardhatContracts.contracts.NatureCarbonTonne.abi,
        owner
      );

      const iface = new Interface(
        '[{"inputs":[{"internalType":"address","name":"childChainManager","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"userAddress","type":"address"},{"indexed":false,"internalType":"address payable","name":"relayerAddress","type":"address"},{"indexed":false,"internalType":"bytes","name":"functionSignature","type":"bytes"}],"name":"MetaTransactionExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"CHILD_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"CHILD_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEPOSITOR_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ERC712_VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"bytes","name":"depositData","type":"bytes"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"userAddress","type":"address"},{"internalType":"bytes","name":"functionSignature","type":"bytes"},{"internalType":"bytes32","name":"sigR","type":"bytes32"},{"internalType":"bytes32","name":"sigS","type":"bytes32"},{"internalType":"uint8","name":"sigV","type":"uint8"}],"name":"executeMetaTransaction","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"getChainId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getDomainSeperator","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getNonce","outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
      );
      iface.format(FormatTypes.full);

      const weth = new ethers.Contract(addresses.weth, iface, owner);

      await (
        await weth.approve(offsetHelper.address, parseEther("1.0"))
      ).wait();

      await expect(
        offsetHelper["swap(address,address,uint256)"](
          addresses.weth,
          addresses.nct,
          parseEther("1.0")
        )
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should swap WETH for 1.0 BCT", async function () {
      // since I have no WETH, I need to impersonate an account that has it
      // I'll also give it some wei just to be safe
      const addressToImpersonate = "0xdc9232e2df177d7a12fdff6ecbab114e2231198d";
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

      const initialBalance = await bct.balanceOf(offsetHelper.address);

      const iface = new Interface(
        '[{"inputs":[{"internalType":"address","name":"childChainManager","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"userAddress","type":"address"},{"indexed":false,"internalType":"address payable","name":"relayerAddress","type":"address"},{"indexed":false,"internalType":"bytes","name":"functionSignature","type":"bytes"}],"name":"MetaTransactionExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"CHILD_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"CHILD_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEPOSITOR_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ERC712_VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ROOT_CHAIN_ID_BYTES","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"bytes","name":"depositData","type":"bytes"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"userAddress","type":"address"},{"internalType":"bytes","name":"functionSignature","type":"bytes"},{"internalType":"bytes32","name":"sigR","type":"bytes32"},{"internalType":"bytes32","name":"sigS","type":"bytes32"},{"internalType":"uint8","name":"sigV","type":"uint8"}],"name":"executeMetaTransaction","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"getChainId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getDomainSeperator","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getNonce","outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
      );
      iface.format(FormatTypes.full);

      const weth = new ethers.Contract(addresses.weth, iface, owner);

      await (
        await weth
          .connect(signer)
          .approve(offsetHelper.address, parseEther("1.0"))
      ).wait();

      await (
        await offsetHelper
          .connect(signer)
          ["swap(address,address,uint256)"](
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
        formatEther(
          await offsetHelper.balances(
            "0xdc9232e2df177d7a12fdff6ecbab114e2231198d",
            addresses.bct
          )
        )
      ).to.be.eql("1.0");
    });
  });
});
