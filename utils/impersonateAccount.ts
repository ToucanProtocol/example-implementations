import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import addresses from "./addresses";

const impersonateAccount = async (
  oldAddress: string,
  addressToImpersonate: string
): Promise<SignerWithAddress> => {
  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [oldAddress],
  });
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addressToImpersonate],
  });
  const signer: SignerWithAddress = await ethers.getSigner(
    addressToImpersonate
  );
  return signer;
};

export default impersonateAccount;
