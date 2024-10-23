import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { StableForwarder } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' }
];

const ForwardRequest = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'gas', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint48' },
  { name: 'data', type: 'bytes' }
];


const getMetaTxTypeData = (chainId: string, verifyingContract: string, version712:string,domainName:string) => {
  return {
    types: {
      EIP712Domain,
      ForwardRequest,
    },
    domain: {
      name: domainName,
      version:version712,
      chainId,
      verifyingContract,
    },
    primaryType: 'ForwardRequest',
  }
};


const genMetaTxnCompleteReq = async (fromSigner: HardhatEthersSigner,
  toAddress: string,
  encodedFnData: string,
  forwarderContractInstance,
  deadline: number
  ,version712:string,domainName:string
) => {

  const from = await fromSigner.getAddress();
  const to = toAddress;
  const data = encodedFnData
  const request = await signMetaTxRequest(fromSigner, forwarderContractInstance, { to, from, data, deadline },version712,domainName);
  return request;

}

const signMetaTxRequest = async (signer: HardhatEthersSigner, forwarder, input: Object,version712:string,domainName:string) => {

  const request = await buildRequest(forwarder, input);
  const toSign = await buildTypedData(forwarder, request,version712,domainName);
  const signature = await signTypedData(signer, toSign);
  request.signature = signature
  return request;
}

const buildRequest = async (forwarder, input) => {
  const nonce = await forwarder.nonces(input.from)
  return { value: 0n, gas: 1e6, nonce, ...input };
}

const buildTypedData = async (forwarder, request, version712:string,domainName:string) => {
  const chainId = hre.network.config.chainId?.toString()
  if (!chainId)
    throw "chain id not defined"
  const typeData = getMetaTxTypeData(chainId, await forwarder.getAddress(),version712,domainName);
  return { ...typeData, message: request };
}

const signTypedData = async (signer: HardhatEthersSigner, data) => {
  const newTypes = {
    ForwardRequest: data.types.ForwardRequest
  }
  // console.log("types gen done. data:",data)
  return await signer.signTypedData(data.domain, newTypes, data.message);
}

describe("Stable", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    const domainName = "StableForwarder"
    const defVersion = "1"
    // const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    // const ONE_GWEI = 1_000_000_000;

    // const lockedAmount = ONE_GWEI;
    // const validTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount, relayer] = await hre.ethers.getSigners();

    const Forwarder = await hre.ethers.getContractFactory(domainName);
    const forwarder = await Forwarder.deploy({ value: hre.ethers.parseEther("10") });
    await forwarder.waitForDeployment();

    const Stable = await hre.ethers.getContractFactory("Stable");
    const coin = await Stable.deploy("Stable1", "ST1", await forwarder.getAddress());
    await coin.waitForDeployment();

    return { forwarder, relayer, coin, owner, otherAccount,domainName,defVersion };
  }

  describe("metaTxn", function () {
    it("Should mint at the expense of relayer wallet", async function () {
      const { coin, forwarder, owner, otherAccount, relayer,defVersion,domainName } = await loadFixture(deployFixture);
      const ONE_GWEI = 1_000_000_000;
      const mintAmt = ONE_GWEI;
      const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;

      const validTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      expect(await coin.balanceOf(await otherAccount.getAddress())).to.equal(hre.ethers.parseEther("0"));


      const data = coin.interface.encodeFunctionData('mint', [otherAccount.address, mintAmt]);
      await forwarder.connect(relayer).execute(await genMetaTxnCompleteReq(
        owner,
        await coin.getAddress(),
        data,
        forwarder,
        validTime,defVersion,domainName

      ))

      expect(await coin.balanceOf(await otherAccount.getAddress())).to.equal(mintAmt);
    });

    it("Should not mint when owner isnt initiating", async function () {
      const { coin, forwarder, owner, otherAccount, relayer,defVersion,domainName } = await loadFixture(deployFixture);
      const ONE_GWEI = 1_000_000_000;
      const mintAmt = ONE_GWEI;
      const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;

      const validTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      expect(await coin.balanceOf(await otherAccount.getAddress())).to.equal(hre.ethers.parseEther("0"));


      const data = coin.interface.encodeFunctionData('mint', [otherAccount.address, mintAmt]);
      let failingMint = forwarder.connect(relayer).execute(await genMetaTxnCompleteReq(
        otherAccount,
        await coin.getAddress(),
        data,
        forwarder,
        validTime,
        defVersion,domainName
      ))

      expect(failingMint).to.be.reverted;
    });

    it("Should transfer at the expense of relayer wallet", async function () {
      const { coin, forwarder, owner, otherAccount, relayer,defVersion,domainName } = await loadFixture(deployFixture);
      const ONE_GWEI = 1_000_000_000;
      const mintAmt = ONE_GWEI;
      const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;

      const validTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      expect(await coin.balanceOf(await otherAccount.getAddress())).to.equal(hre.ethers.parseEther("0"));


      const data = coin.interface.encodeFunctionData('mint', [otherAccount.address, mintAmt]);
      await forwarder.connect(relayer).execute(
        await genMetaTxnCompleteReq(
          owner,
          await coin.getAddress(),
          data,
          forwarder,
          validTime,defVersion,domainName
        ))

      expect(await coin.balanceOf(await otherAccount.getAddress())).to.equal(mintAmt);

      const dataTransfer = coin.interface.encodeFunctionData('transfer', [relayer.address, mintAmt]);
      await forwarder.connect(relayer).execute(
        await genMetaTxnCompleteReq(
          otherAccount,
          await coin.getAddress(),
          dataTransfer,
          forwarder,
          validTime,
          defVersion,domainName
        ))

      expect(await coin.balanceOf(await relayer.getAddress())).to.equal(mintAmt);
    });

  });

});
