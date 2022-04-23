import { ethers } from "hardhat";
import addresses from "../utils/addresses";
import tokens from "../utils/tokens";

async function main() {
  const OffsetHelper = await ethers.getContractFactory("OffsetHelper");
  const oh = await OffsetHelper.deploy(
    tokens,
    [
      addresses.bct,
      addresses.nct,
      addresses.usdc,
      addresses.weth,
      addresses.wmatic,
    ]
  );

  await oh.deployed();

  console.log("OffsetHelper deployed to:", oh.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
