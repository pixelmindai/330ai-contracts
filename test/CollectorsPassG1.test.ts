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
const BASE_TOKEN_URI: string = "https://backend.pixelmind.ai/api/v1/metadata/CollectorsPassG1/";
const BASE_TOKEN_URI_UPDATED: string = "https://meta.pixelmind.ai/api/v1/metadata/CollectorsPassG2/";

let collectorsPassG1: Contract;
let contractOwnerG1: SignerWithAddress;

let collectorsPassG2: Contract;

let addrs: SignerWithAddress[];
let addrsInvalid: string[];

let merkleGenerateOutput: MerkleGenerateOutput;
let merkleGenerateOutputInvalid: MerkleGenerateOutput;

describe("CollectorsPassG1", () => {
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
    const CollectorsPassG1 = await ethers.getContractFactory("CollectorsPassG1");
    collectorsPassG1 = await CollectorsPassG1.deploy(BASE_TOKEN_URI, MAX_SUPPLY, MERKLE_ROOT);
    await collectorsPassG1.deployed();
    collectorsPassG2 = await CollectorsPassG1.deploy(BASE_TOKEN_URI, MAX_SUPPLY, MERKLE_ROOT);
    await collectorsPassG2.deployed();
  });

  describe("deploys correctly", () => {
    it("deploys", async () => {
      assert.isOk(collectorsPassG1.address);
    });
    it("deploys with correct owner", async () => {
      expect(await collectorsPassG1.owner()).to.equal(contractOwnerG1.address);
    });
    it("deploys with correct base token uri", async () => {
      expect(await collectorsPassG1.baseTokenURI()).to.equal(BASE_TOKEN_URI);
    });
    it("deploys with correct max supply", async () => {
      expect(await collectorsPassG1.maxSupply()).to.equal(MAX_SUPPLY);
    });
    it("deploys with correct merkle root", async () => {
      expect(await collectorsPassG1.root()).to.equal(MERKLE_ROOT);
    });
  });

  describe("has working merkle proof verification", () => {
    it("correctly validates 'valid' data blocks", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await assert.isOk(collectorsPassG1.connect(a.address).checkRedeem(proof));
      }
    });
    it("correctly validates 'invalid' data blocks", async () => {
      for (const a of addrsInvalid) {
        const k = keccak256(a).toString("hex");
        await expect(collectorsPassG1.connect(a).checkRedeem(merkleGenerateOutputInvalid.proof[k])).to.be.revertedWith(
          "InvalidMerkleProof",
        );
      }
    });
  });

  describe("can be minted", () => {
    it("allows whitelisted accounts to mint", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        assert.isOk(await collectorsPassG1.connect(a).redeem(proof));
      }
    });
    it("allows whitelisted accounts to mint only once", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        assert.isOk(await collectorsPassG1.connect(a).redeem(proof));
        await expect(collectorsPassG1.connect(a).redeem(proof)).to.be.revertedWith("PassAlreadyClaimed");
      }
    });
    it("allows whitelisted accounts to mint in multiple groups", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).redeem(proof);
        assert.isOk(await collectorsPassG2.connect(a).redeem(proof));
      }
    });
    it("does not allow minting beyond max supply", async () => {
      for (const a of addrs.slice(0, MAX_SUPPLY)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).redeem(proof);
      }
      const k = keccak256(addrs[MAX_SUPPLY].address).toString("hex");
      const proof = merkleGenerateOutput.proof[k];
      await expect(collectorsPassG1.connect(addrs[MAX_SUPPLY]).redeem(proof)).to.be.revertedWith("MaxSupplyReached");
    });
    it("does not leak supply", async () => {
      for (const a of addrs.slice(0, MAX_SUPPLY)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).redeem(proof);
      }
      const k = keccak256(addrs[MAX_SUPPLY].address).toString("hex");
      const proof = merkleGenerateOutput.proof[k];
      await expect(collectorsPassG1.connect(addrs[MAX_SUPPLY]).redeem(proof)).to.be.revertedWith("MaxSupplyReached");
      expect(await collectorsPassG1.totalSupply()).to.equal(MAX_SUPPLY);
    });
  });

  describe("has working metadata", () => {
    it("allows contract owner to update base uri", async () => {
      await collectorsPassG1.setBaseURI(BASE_TOKEN_URI_UPDATED);
      expect(await collectorsPassG1.baseTokenURI()).to.not.equal(BASE_TOKEN_URI);
      expect(await collectorsPassG1.baseTokenURI()).to.equal(BASE_TOKEN_URI_UPDATED);
    });
    it("only allows contract owner to update base uri", async () => {
      await expect(collectorsPassG1.connect(addrs[0]).setBaseURI(BASE_TOKEN_URI_UPDATED)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
    it("generates correct token uri", async () => {
      const k = keccak256(addrs[0].address).toString("hex");
      const proof = merkleGenerateOutput.proof[k];
      const tx = await collectorsPassG1.connect(addrs[0]).redeem(proof);
      const receipt: ContractReceipt = await tx.wait();
      const transfer = receipt.events?.filter(x => {
        return x.event == "Transfer";
      })[0];
      const tokenId = transfer ? (transfer.args ? transfer.args[2] : 0) : 0;
      expect(await collectorsPassG1.connect(addrs[0]).tokenURI(tokenId)).to.equal(BASE_TOKEN_URI + tokenId);
    });
    it("generates correct token uri after updating base uri", async () => {
      const k = keccak256(addrs[0].address).toString("hex");
      const proof = merkleGenerateOutput.proof[k];
      const tx = await collectorsPassG1.connect(addrs[0]).redeem(proof);
      const receipt: ContractReceipt = await tx.wait();
      const transfer = receipt.events?.filter(x => {
        return x.event == "Transfer";
      })[0];
      const tokenId = transfer ? (transfer.args ? transfer.args[2] : 0) : 0;
      await collectorsPassG1.setBaseURI(BASE_TOKEN_URI_UPDATED);
      expect(await collectorsPassG1.connect(addrs[0]).tokenURI(tokenId)).to.equal(BASE_TOKEN_URI_UPDATED + tokenId);
    });
  });

  describe("can be enumerated", () => {
    it("returns correct total supply", async () => {
      for (const [i, a] of addrs.slice(0, 3).entries()) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).redeem(proof);
        expect(await collectorsPassG1.totalSupply()).to.equal(i + 1);
      }
    });
    it("returns correct token by index", async () => {
      for (const a of addrs.slice(0, MAX_SUPPLY)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).redeem(proof);
      }
      for (const [i, _] of addrs.slice(0, MAX_SUPPLY - 1).entries()) {
        // (i + 1) => because contract counter '_tokenIds' starts at 1
        expect(await collectorsPassG1.tokenByIndex(i)).to.equal(i + 1);
      }
    });
    it("returns correct token of owner by index", async () => {
      for (const a of addrs.slice(0, MAX_SUPPLY).reverse()) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).redeem(proof);
      }
      for (const [i, a] of addrs.slice(0, MAX_SUPPLY).entries()) {
        // (... - i + 1) => because contract counter '_tokenIds' starts at 1
        expect(await collectorsPassG1.tokenOfOwnerByIndex(a.address, 0)).to.equal(MAX_SUPPLY - 1 - i + 1);
      }
    });
  });
});
