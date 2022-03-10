import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import {
  NatureCarbonTonne,
  OffsetHelper,
  ToucanCarbonOffsets,
} from "../typechain";
import * as tcoAbi from "../artifacts/contracts/CO2KEN_contracts/ToucanCarbonOffsets.sol/ToucanCarbonOffsets.json";

const getTotalTCO2sHeld = async (
  nct: NatureCarbonTonne,
  offsetHelper: OffsetHelper,
  owner: SignerWithAddress
): Promise<BigNumber> => {
  const scoredTCO2s = await nct.getScoredTCO2s();

  let tokenContract: ToucanCarbonOffsets;
  let totalTCO2sHeld = parseEther("0.0");

  await Promise.all(
    scoredTCO2s.map(async (token: string) => {
      // @ts-ignore
      tokenContract = new ethers.Contract(token, tcoAbi.abi, owner);
      const balance = await tokenContract.balanceOf(offsetHelper.address);
      totalTCO2sHeld = totalTCO2sHeld.add(balance);
    })
  );

  return totalTCO2sHeld;
};

export default getTotalTCO2sHeld;
