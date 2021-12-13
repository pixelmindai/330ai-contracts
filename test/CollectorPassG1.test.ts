import { Contract, ContractReceipt } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect, assert } from "chai";
import { ethers } from "hardhat";

import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

interface MerkleGenerateOutput {
  root: string;
  proof: {
    [key: string]: Array<string>;
  };
}

let MERKLE_ROOT: string;

const MAX_SUPPLY: number = 6;
const TOKEN_URI: string = "https://meta.330.ai/01/";
const TOKEN_URI_UPDATED: string = "https://meta.pixelmind.ai/01/";

let collectorPassG1: Contract;
let contractOwnerG1: SignerWithAddress;

let collectorPassG2: Contract;

let addrs: SignerWithAddress[];
let addrsInvalid: string[];

let merkleGenerateOutput: MerkleGenerateOutput;
let merkleGenerateOutputInvalid: MerkleGenerateOutput;

describe("CollectorPassG1", () => {
  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    [contractOwnerG1, ...addrs] = await ethers.getSigners();

    // valid Merkle tree
    const pubKeys = addrs.slice(0, MAX_SUPPLY + 1).map(a => a.address);
    const leafNodes = pubKeys.map(pk => keccak256(pk));
    const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
    merkleGenerateOutput = {
      root: merkleTree.getHexRoot(),
      proof: leafNodes.reduce((map, ln) => {
        const k = ln.toString("hex");
        map[k] = merkleTree.getHexProof(ln);
        return map;
      }, {}),
    };
    MERKLE_ROOT = merkleGenerateOutput.root;

    // invalid Merkle tree
    addrsInvalid = [
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002",
    ];
    const leafNodesInvalid = addrsInvalid.map(pk => keccak256(pk));
    const merkleTreeInvalid = new MerkleTree(leafNodesInvalid, keccak256, { sortPairs: true });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    merkleGenerateOutputInvalid = {
      root: merkleTreeInvalid.getHexRoot(),
      proof: leafNodesInvalid.reduce((map, ln) => {
        const k = ln.toString("hex");
        map[k] = merkleTreeInvalid.getHexProof(ln);
        return map;
      }, {}),
    };
  });

  beforeEach(async () => {
    const CollectorPassG1 = await ethers.getContractFactory("CollectorPassG1");
    collectorPassG1 = await CollectorPassG1.deploy(TOKEN_URI, MAX_SUPPLY, MERKLE_ROOT);
    await collectorPassG1.deployed();
    collectorPassG2 = await CollectorPassG1.deploy(TOKEN_URI, MAX_SUPPLY, MERKLE_ROOT);
    await collectorPassG2.deployed();
  });

  describe("deploys correctly", () => {
    it("deploys", async () => {
      assert.isOk(collectorPassG1.address);
    });
    it("deploys with correct owner", async () => {
      expect(await collectorPassG1.owner()).to.equal(contractOwnerG1.address);
    });
    it("deploys with correct max supply", async () => {
      expect(await collectorPassG1.baseTokenURI()).to.equal(TOKEN_URI);
    });
    it("deploys with correct base token uri", async () => {
      expect(await collectorPassG1.baseTokenURI()).to.equal(TOKEN_URI);
    });
    it("deploys with correct merkle root", async () => {
      expect(await collectorPassG1.root()).to.equal(MERKLE_ROOT);
    });
  });

  describe("has working merkle proof verification", () => {
    it("correctly validates 'valid' data blocks", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await assert.isOk(collectorPassG1.connect(a.address).checkRedeem(proof));
      }
    });
    it("correctly validates 'invalid' data blocks", async () => {
      for (const a of addrsInvalid) {
        const k = keccak256(a).toString("hex");
        assert.isNotOk(await collectorPassG1.connect(a).checkRedeem(merkleGenerateOutputInvalid.proof[k]));
      }
    });
  });

  describe("can be minted", () => {
    it("allows whitelisted accounts to mint", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        assert.isOk(await collectorPassG1.connect(a).redeem(proof));
      }
    });
    it("allows whitelisted accounts to mint only once", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        assert.isOk(await collectorPassG1.connect(a).redeem(proof));
        await expect(collectorPassG1.connect(a).redeem(proof)).to.be.revertedWith("User already has a pass");
      }
    });
    it("allows whitelisted accounts to mint in multiple groups", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorPassG1.connect(a).redeem(proof);
        assert.isOk(await collectorPassG2.connect(a).redeem(proof));
      }
    });
    it("does not allow minting beyond max supply", async () => {
      for (const a of addrs.slice(0, MAX_SUPPLY - 1)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorPassG1.connect(a).redeem(proof);
      }
      const k = keccak256(addrs[MAX_SUPPLY].address).toString("hex");
      const proof = merkleGenerateOutput.proof[k];
      await expect(collectorPassG1.connect(addrs[MAX_SUPPLY]).redeem(proof)).to.be.revertedWith(
        "There are no more passes to redeem",
      );
    });
  });

  describe("has working metadata", () => {
    it("allows contract owner to update base uri", async () => {
      await collectorPassG1.setBaseURI(TOKEN_URI_UPDATED);
      expect(await collectorPassG1.baseTokenURI()).to.not.equal(TOKEN_URI);
      expect(await collectorPassG1.baseTokenURI()).to.equal(TOKEN_URI_UPDATED);
    });
    it("only allows contract owner to update base uri", async () => {
      await expect(collectorPassG1.connect(addrs[0]).setBaseURI(TOKEN_URI_UPDATED)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
    it("generates correct token uri", async () => {
      const k = keccak256(addrs[0].address).toString("hex");
      const proof = merkleGenerateOutput.proof[k];

      const tx = await collectorPassG1.connect(addrs[0]).redeem(proof);
      const receipt: ContractReceipt = await tx.wait();

      const transfer = receipt.events?.filter(x => {
        return x.event == "Transfer";
      })[0];
      const tokenId = transfer ? (transfer.args ? transfer.args[2] : 0) : 0;
      expect(await collectorPassG1.connect(addrs[0]).tokenURI(tokenId)).to.equal(TOKEN_URI + tokenId);
    });
    it("generates correct token uri after updating base uri", async () => {
      const k = keccak256(addrs[0].address).toString("hex");
      const proof = merkleGenerateOutput.proof[k];

      const tx = await collectorPassG1.connect(addrs[0]).redeem(proof);
      const receipt: ContractReceipt = await tx.wait();

      const transfer = receipt.events?.filter(x => {
        return x.event == "Transfer";
      })[0];
      const tokenId = transfer ? (transfer.args ? transfer.args[2] : 0) : 0;
      await collectorPassG1.setBaseURI(TOKEN_URI_UPDATED);
      expect(await collectorPassG1.connect(addrs[0]).tokenURI(tokenId)).to.equal(TOKEN_URI_UPDATED + tokenId);
    });
  });
});
