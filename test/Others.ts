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
import impersonateAccount from "../utils/impersonateAccount";

describe("Offset Helper - Others", function () {
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

    it("Should fail to deposit cause I have no NCT", async function () {
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

    it("Should fail to withdraw cause I haven't deposited enough NCT", async function () {
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
});
