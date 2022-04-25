import { ethers, network } from "hardhat";
import addresses, { mumbaiAddresses } from "../utils/addresses";
import { tokens } from "../utils/tokens";

async function main() {
  const OffsetHelper = await ethers.getContractFactory("OffsetHelper");
  if (network.name === "mumbai") {
    const oh = await OffsetHelper.deploy(tokens, [
      mumbaiAddresses.bct,
      mumbaiAddresses.nct,
      mumbaiAddresses.usdc,
      mumbaiAddresses.weth,
      mumbaiAddresses.wmatic,
    ]);
    console.log("OffsetHelper deployed on Mumbai to:", oh.address);
    await oh.deployed();
  } else {
    const oh = await OffsetHelper.deploy(tokens, [
      addresses.bct,
      addresses.nct,
      addresses.usdc,
      addresses.weth,
      addresses.wmatic,
    ]);
    console.log("OffsetHelper deployed on Polygon to:", oh.address);
    await oh.deployed();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
