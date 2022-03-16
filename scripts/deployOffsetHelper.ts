import { ethers } from "hardhat";
import addresses from "../utils/addresses";

async function main() {
  const OffsetHelper = await ethers.getContractFactory("OffsetHelper");
  const oh = await OffsetHelper.deploy(
    ["BCT", "NCT", "USDC", "WETH", "WMATIC"],
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
