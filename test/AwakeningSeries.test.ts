import { ethers } from "hardhat";
import chai, { assert } from "chai";
import { solidity } from "ethereum-waffle";
import { AwakeningSeries__factory, AwakeningSeries } from "../typechain";

chai.use(solidity);
const { expect } = chai;

describe("Awakening Series", () => {
  let instance: AwakeningSeries;

  const user1Data =
    "0x54d3cf5d0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002c427079774443635573446e5562646a4741675534697636634232327a6a32596a3238456653685a70726a78760000000000000000000000000000000000000000";

  const user2Data =
    "0x54d3cf5d0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002c427079774443635573446e5562646a4741675534697636634232327a6a32596a3238456653685a70726a78760000000000000000000000000000000000000001";

  const invalidData =
    "0x54d3cf5d4000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002c427079774443635573446e5562646a4741675534697636634232327a6a32596a3238456653685a70726a78760000000000000000000000000000000000000001";

  // 60 mins from the current timestamp
  const mintDeadline = 1634047750;

  // sample root for testing
  const merkelRoot = "0xafde3f7e67c99e3b964fc486d9aa242c8f7cc7a614f239b5328d7c4396a966d5";

  // sample config for testing
  const proofConfig: any[] = [
    // valid proofs
    {
      "0x54d3cf5d0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002c427079774443635573446e5562646a4741675534697636634232327a6a32596a3238456653685a70726a78760000000000000000000000000000000000000000":
        {
          index: 0,
          proof: ["0x7f4c2c044c8d20fa27564cf703ef6e7ac917313ff9e83ba03a0d74c62d10ec38"],
        },
    },
    {
      "0x54d3cf5d0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002c427079774443635573446e5562646a4741675534697636634232327a6a32596a3238456653685a70726a78760000000000000000000000000000000000000001":
        {
          index: 1,
          proof: ["0x63ce5ddcce1cb24eecbb86694a801de410da39e91694bc7c0df19453c4863abf"],
        },
    },
    // invalid proof
    {
      "0x54d3cf5d4000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002c427079774443635573446e5562646a4741675534697636634232327a6a32596a3238456653685a70726a78760000000000000000000000000000000000000001":
        {
          index: 3,
          proof: ["0x63ce5ddcde1cb24eecbb86694a801de410da39e91694bc7c0df19453c4863abf"],
        },
    },
  ];

  beforeEach(async () => {
    const [deployer] = await ethers.getSigners();

    const seriesDeployer = new AwakeningSeries__factory(deployer);
    instance = await seriesDeployer.deploy(merkelRoot, mintDeadline, "https://meta.330.ai/01/");
  });

  describe("should allow users to mint", async () => {
    it("makes sure the 1st verified account can mint", async () => {
      const [deployer] = await ethers.getSigners();
      await instance.mint(proofConfig[0][user1Data].index, proofConfig[0][user1Data].proof, user1Data);
      const owner = await instance.ownerOf(0);
      assert(owner === deployer.address);
      const tokenUrl = await instance.tokenURI(0);
      assert(tokenUrl == "https://meta.330.ai/01/0");
    });

    it("makes sure the 2nd verified account can mint", async () => {
      const [, user] = await ethers.getSigners();
      await instance.mint(proofConfig[0][user1Data].index, proofConfig[0][user1Data].proof, user1Data);
      await instance.connect(user).mint(proofConfig[1][user2Data].index, proofConfig[1][user2Data].proof, user2Data);
      const owner = await instance.ownerOf(1);
      assert(owner === user.address);
      const tokenUrl = await instance.tokenURI(1);
      assert(tokenUrl == "https://meta.330.ai/01/1");
    });

    it("reverts if invalid proof is provided", async () => {
      await expect(
        instance.mint(proofConfig[0][user1Data].index, proofConfig[2][invalidData].proof, invalidData),
      ).to.be.revertedWith("MerkelValidator: Invalid proof");
    });

    it("reverts if mint deadline is passed", async () => {
      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      const currentTimestamp = block.timestamp;
      for (let i = 0; i < mintDeadline - currentTimestamp; i++) {
        await ethers.provider.send("evm_mine", []);
      }
      await expect(
        instance.mint(proofConfig[0][user1Data].index, proofConfig[0][user1Data].proof, user1Data),
      ).to.be.revertedWith("AwakeningSeries: Minting Over");
    });
  });

  describe("owner should be able to perform metadata updates", async () => {
    it("reverts if a non-owner tries to update the token base uri", async () => {
      const [, user] = await ethers.getSigners();
      await expect(instance.connect(user).setBaseURI("https://beta.330.ai/01/")).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("allows owner to update the token base uri", async () => {
      await instance.setBaseURI("https://beta.330.ai/01/");
      const baseUri = await instance.baseTokenURI();
      assert(baseUri == "https://beta.330.ai/01/");
    });
  });
});
