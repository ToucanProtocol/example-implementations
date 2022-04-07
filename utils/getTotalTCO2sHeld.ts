import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { OffsetHelper } from "../typechain";
import { IToucanPoolToken, ToucanCarbonOffsets } from "../typechain";
import * as tcoContract from "../artifacts/contracts/interfaces/IToucanCarbonOffsets.sol/IToucanCarbonOffsets.json";

const getTotalTCO2sHeld = async (
  pooltoken: IToucanPoolToken,
  offsetHelper: OffsetHelper,
  owner: SignerWithAddress
): Promise<BigNumber> => {
  const scoredTCO2s = await pooltoken.getScoredTCO2s();

  let tokenContract: ToucanCarbonOffsets;
  let totalTCO2sHeld = parseEther("0.0");

  await Promise.all(
    scoredTCO2s.map(async (token: string) => {
      // @ts-ignore
      tokenContract = new ethers.Contract(token, tcoContract.abi, owner);
      const balance = await tokenContract.balanceOf(offsetHelper.address);
      totalTCO2sHeld = totalTCO2sHeld.add(balance);
    })
  );

  return totalTCO2sHeld;
};

export default getTotalTCO2sHeld;
