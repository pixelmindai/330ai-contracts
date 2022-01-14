import { Contract, ContractReceipt } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { BlockTag } from "@ethersproject/providers";

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

const MINT_PRICE_WEI: BigNumber = ethers.utils.parseEther("0.1");
const NOW: number = Math.trunc(Date.now() / 1000);
const ONE_HOUR: number = 60 * 60;
const ZERO_SECONDS: number = 0;
const WHITELIST_MINT_NOT_BEFORE: number = NOW - ONE_HOUR;
const WHITELIST_MINT_DURATION: number = 24 * 60 * 60;

let collectorsPassG1: Contract;
let contractOwnerG1: SignerWithAddress;
let contractBeneficiaryG1: SignerWithAddress;

let addrs: SignerWithAddress[];
let addrsInvalid: string[];

let merkleGenerateOutput: MerkleGenerateOutput;
let merkleGenerateOutputInvalid: MerkleGenerateOutput;

describe("CollectorsPassG1", () => {
  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    [contractOwnerG1, contractBeneficiaryG1, ...addrs] = await ethers.getSigners();

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
    collectorsPassG1 = await CollectorsPassG1.deploy(
      BASE_TOKEN_URI,
      MAX_SUPPLY,
      MERKLE_ROOT,
      MINT_PRICE_WEI,
      WHITELIST_MINT_NOT_BEFORE,
      WHITELIST_MINT_DURATION,
      contractBeneficiaryG1.address,
    );
    await collectorsPassG1.deployed();
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
      expect(await collectorsPassG1.merkleroot()).to.equal(MERKLE_ROOT);
    });
    it("deploys with correct whitelist not before time", async () => {
      expect(await collectorsPassG1.whitelistNotBeforeTime()).to.equal(WHITELIST_MINT_NOT_BEFORE);
    });
    it("deploys with correct whitelist end time", async () => {
      const endTime = await collectorsPassG1.whitelistMintEndTime();
      const blockTag: BlockTag = collectorsPassG1.deployTransaction.blockNumber || "latest";
      const blockTimestamp = (await collectorsPassG1.provider.getBlock(blockTag)).timestamp;
      const duration = endTime - blockTimestamp;
      expect(duration).to.equal(WHITELIST_MINT_DURATION);
    });
    it("deploys with correct beneficiary address", async () => {
      expect(await collectorsPassG1.beneficiaryAddress()).to.equal(contractBeneficiaryG1.address);
    });
  });

  describe("has working merkle proof verification", () => {
    it("correctly validates 'valid' data blocks", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await assert.isOk(collectorsPassG1.connect(a.address).checkWhitelistRedeem(proof));
      }
    });
    it("correctly validates 'invalid' data blocks", async () => {
      for (const a of addrsInvalid) {
        const k = keccak256(a).toString("hex");
        await expect(
          collectorsPassG1.connect(a).checkWhitelistRedeem(merkleGenerateOutputInvalid.proof[k]),
        ).to.be.revertedWith("InvalidMerkleProof");
      }
    });
  });

  describe("can be minted", () => {
    it("allows accounts to mint only with exact price", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await expect(
          collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
            value: MINT_PRICE_WEI.sub(1),
          }),
        ).to.be.revertedWith("IncorrectEthEmount");
        await expect(
          collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
            value: MINT_PRICE_WEI.add(1),
          }),
        ).to.be.revertedWith("IncorrectEthEmount");
        assert.isOk(
          await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
            value: MINT_PRICE_WEI,
          }),
        );
      }
    });
    it("allows whitelisted accounts to mint", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        assert.isOk(
          await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
            value: MINT_PRICE_WEI,
          }),
        );
      }
    });
    it("allows whitelisted accounts to mint only once", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        assert.isOk(
          await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
            value: MINT_PRICE_WEI,
          }),
        );
        await expect(
          collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
            value: MINT_PRICE_WEI,
          }),
        ).to.be.revertedWith("PassAlreadyClaimed");
      }
    });
    it("allows whitelisted accounts to mint in multiple groups", async () => {
      const CollectorsPassG1 = await ethers.getContractFactory("CollectorsPassG1");
      const collectorsPassG2: Contract = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        WHITELIST_MINT_NOT_BEFORE,
        WHITELIST_MINT_DURATION,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG2.deployed();
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        });
        assert.isOk(
          await collectorsPassG2.connect(a).whitelistMintRedeem(proof, {
            value: MINT_PRICE_WEI,
          }),
        );
      }
    });
    it("does not allow whitelisted accounts to mint before whitelist window", async () => {
      const CollectorsPassG1 = await ethers.getContractFactory("CollectorsPassG1");
      collectorsPassG1 = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        NOW + ONE_HOUR,
        WHITELIST_MINT_DURATION,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG1.deployed();
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await expect(
          collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
            value: MINT_PRICE_WEI,
          }),
        ).to.be.revertedWith("WhitelistMintNotStarted");
      }
    });
    it("does not allow whitelisted accounts to mint after whitelist window", async () => {
      const CollectorsPassG1 = await ethers.getContractFactory("CollectorsPassG1");
      collectorsPassG1 = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        WHITELIST_MINT_NOT_BEFORE,
        ZERO_SECONDS,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG1.deployed();
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await expect(
          collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
            value: MINT_PRICE_WEI,
          }),
        ).to.be.revertedWith("WhitelistMintEnded");
      }
    });
    it("allows activating open mint only after whitelist window", async () => {
      await expect(collectorsPassG1.connect(contractOwnerG1).setOpenMintActive()).to.be.revertedWith(
        "WhitelistMintNotEnded",
      );
      const CollectorsPassG1 = await ethers.getContractFactory("CollectorsPassG1");
      collectorsPassG1 = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        NOW + ONE_HOUR,
        WHITELIST_MINT_DURATION,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG1.deployed();
      await expect(collectorsPassG1.connect(contractOwnerG1).setOpenMintActive()).to.be.revertedWith(
        "WhitelistMintNotEnded",
      );
      collectorsPassG1 = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        WHITELIST_MINT_NOT_BEFORE,
        ZERO_SECONDS,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG1.deployed();
      assert.isOk(await collectorsPassG1.connect(contractOwnerG1).setOpenMintActive());
    });
    it("allows non-whitelisted accounts to mint only after activating open mint", async () => {
      const CollectorsPassG1 = await ethers.getContractFactory("CollectorsPassG1");
      collectorsPassG1 = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        WHITELIST_MINT_NOT_BEFORE,
        ZERO_SECONDS,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG1.deployed();
      for (const a of addrs.slice(MAX_SUPPLY + 1, MAX_SUPPLY + 4)) {
        await expect(
          collectorsPassG1.connect(a).openMintRedeem({
            value: MINT_PRICE_WEI,
          }),
        ).to.be.revertedWith("OpenMintNotActive");
      }
      await collectorsPassG1.connect(contractOwnerG1).setOpenMintActive();
      for (const a of addrs.slice(MAX_SUPPLY + 1, MAX_SUPPLY + 4)) {
        assert.isOk(
          await collectorsPassG1.connect(a).openMintRedeem({
            value: MINT_PRICE_WEI,
          }),
        );
      }
    });
    it("allows non-whitelisted accounts to mint only once", async () => {
      const CollectorsPassG1 = await ethers.getContractFactory("CollectorsPassG1");
      collectorsPassG1 = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        WHITELIST_MINT_NOT_BEFORE,
        ZERO_SECONDS,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG1.deployed();
      await collectorsPassG1.connect(contractOwnerG1).setOpenMintActive();
      for (const a of addrs.slice(MAX_SUPPLY + 1, MAX_SUPPLY + 4)) {
        assert.isOk(
          await collectorsPassG1.connect(a).openMintRedeem({
            value: MINT_PRICE_WEI,
          }),
        );
        await expect(
          collectorsPassG1.connect(a).openMintRedeem({
            value: MINT_PRICE_WEI,
          }),
        ).to.be.revertedWith("PassAlreadyClaimed");
      }
    });
    it("allows non-whitelisted accounts to mint in multiple groups", async () => {
      const CollectorsPassG1 = await ethers.getContractFactory("CollectorsPassG1");
      collectorsPassG1 = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        WHITELIST_MINT_NOT_BEFORE,
        ZERO_SECONDS,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG1.deployed();
      const collectorsPassG2: Contract = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        WHITELIST_MINT_NOT_BEFORE,
        ZERO_SECONDS,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG2.deployed();
      await collectorsPassG1.connect(contractOwnerG1).setOpenMintActive();
      await collectorsPassG2.connect(contractOwnerG1).setOpenMintActive();
      for (const a of addrs.slice(MAX_SUPPLY + 1, MAX_SUPPLY + 4)) {
        await collectorsPassG1.connect(a).openMintRedeem({
          value: MINT_PRICE_WEI,
        });
        assert.isOk(
          await collectorsPassG2.connect(a).openMintRedeem({
            value: MINT_PRICE_WEI,
          }),
        );
      }
    });
    it("does not allow all minting to end until whitelist mint has ended", async () => {
      await expect(collectorsPassG1.connect(contractOwnerG1).endAllMinting()).to.be.revertedWith(
        "WhitelistMintNotEnded",
      );
      const CollectorsPassG1 = await ethers.getContractFactory("CollectorsPassG1");
      collectorsPassG1 = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        WHITELIST_MINT_NOT_BEFORE,
        ZERO_SECONDS,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG1.deployed();
      assert.isOk(await collectorsPassG1.connect(contractOwnerG1).endAllMinting());
    });
    it("does not allow any accounts to mint after all minting has ended", async () => {
      const CollectorsPassG1 = await ethers.getContractFactory("CollectorsPassG1");
      collectorsPassG1 = await CollectorsPassG1.deploy(
        BASE_TOKEN_URI,
        MAX_SUPPLY,
        MERKLE_ROOT,
        MINT_PRICE_WEI,
        WHITELIST_MINT_NOT_BEFORE,
        ZERO_SECONDS,
        contractBeneficiaryG1.address,
      );
      await collectorsPassG1.deployed();
      await collectorsPassG1.connect(contractOwnerG1).endAllMinting();
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await expect(
          collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
            value: MINT_PRICE_WEI,
          }),
        ).to.be.revertedWith("AllMintingAlreadyEnded");
      }
      for (const a of addrs.slice(MAX_SUPPLY + 1, MAX_SUPPLY + 4)) {
        await expect(
          collectorsPassG1.connect(a).openMintRedeem({
            value: MINT_PRICE_WEI,
          }),
        ).to.be.revertedWith("AllMintingAlreadyEnded");
      }
    });
    it("does not allow minting beyond max supply", async () => {
      for (const a of addrs.slice(0, MAX_SUPPLY)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        });
      }
      const k = keccak256(addrs[MAX_SUPPLY].address).toString("hex");
      const proof = merkleGenerateOutput.proof[k];
      await expect(
        collectorsPassG1.connect(addrs[MAX_SUPPLY]).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        }),
      ).to.be.revertedWith("MaxSupplyReached");
    });
    it("does not leak supply", async () => {
      for (const a of addrs.slice(0, MAX_SUPPLY)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        });
      }
      const k = keccak256(addrs[MAX_SUPPLY].address).toString("hex");
      const proof = merkleGenerateOutput.proof[k];
      await expect(
        collectorsPassG1.connect(addrs[MAX_SUPPLY]).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        }),
      ).to.be.revertedWith("MaxSupplyReached");
      expect(await collectorsPassG1.totalSupply()).to.equal(MAX_SUPPLY);
    });
  });

  describe("accepts ether", () => {
    it("returns correct balance", async () => {
      for (const [i, a] of addrs.slice(0, 3).entries()) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        });
        expect(await collectorsPassG1.provider.getBalance(collectorsPassG1.address)).to.equal(
          MINT_PRICE_WEI.mul(i + 1),
        );
      }
    });
    it("allows beneficiary address to withdraw correct balance", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        });
      }
      const tx = await collectorsPassG1.connect(contractBeneficiaryG1).withdraw({ gasPrice: 100 });
      const receipt = await collectorsPassG1.provider.getTransactionReceipt(tx.hash);
      const txCost = receipt.effectiveGasPrice.mul(receipt.gasUsed);
      await expect(tx).to.changeEtherBalance(contractBeneficiaryG1, MINT_PRICE_WEI.mul(3).sub(txCost), {
        includeFee: true,
      });
    });
  });
  describe("has working admin functions", () => {
    it("can be paused and unpaused by owner", async () => {
      assert.isOk(await collectorsPassG1.connect(contractOwnerG1).pauseContract());
      assert.isOk(await collectorsPassG1.connect(contractOwnerG1).unpauseContract());
    });
    it("can only be paused and unpaused by owner", async () => {
      await expect(collectorsPassG1.connect(contractBeneficiaryG1).pauseContract()).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
      await expect(collectorsPassG1.connect(contractBeneficiaryG1).unpauseContract()).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
    it("allows owner to recover correct balance while paused", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        });
      }
      await expect(collectorsPassG1.connect(contractOwnerG1).recoverEth({ gasPrice: 100 })).to.be.revertedWith(
        "Pausable: not paused",
      );
      await collectorsPassG1.connect(contractOwnerG1).pauseContract();
      const tx = await collectorsPassG1.connect(contractOwnerG1).recoverEth({ gasPrice: 100 });
      const receipt = await collectorsPassG1.provider.getTransactionReceipt(tx.hash);
      const txCost = receipt.effectiveGasPrice.mul(receipt.gasUsed);
      await expect(tx).to.changeEtherBalance(contractOwnerG1, MINT_PRICE_WEI.mul(3).sub(txCost), {
        includeFee: true,
      });
    });
    it("only owner can recover balance while paused", async () => {
      for (const a of addrs.slice(0, 3)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        });
      }
      await collectorsPassG1.connect(contractOwnerG1).pauseContract();
      await expect(collectorsPassG1.connect(contractBeneficiaryG1).recoverEth({ gasPrice: 100 })).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
    it("reverts functions that require `paused` to be false", async () => {
      await collectorsPassG1.connect(contractOwnerG1).pauseContract();
      const k = keccak256(addrs[0].address).toString("hex");
      const proof = merkleGenerateOutput.proof[k];
      await expect(
        collectorsPassG1.connect(addrs[0]).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        }),
      ).to.be.revertedWith("Pausable: paused");
      await expect(collectorsPassG1.connect(contractOwnerG1).setOpenMintActive()).to.be.revertedWith(
        "Pausable: paused",
      );
      await expect(
        collectorsPassG1.connect(addrs[MAX_SUPPLY]).openMintRedeem({
          value: MINT_PRICE_WEI,
        }),
      ).to.be.revertedWith("Pausable: paused");
      await expect(collectorsPassG1.connect(contractOwnerG1).endAllMinting()).to.be.revertedWith("Pausable: paused");
      await expect(collectorsPassG1.connect(contractBeneficiaryG1).withdraw()).to.be.revertedWith("Pausable: paused");
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
      const tx = await collectorsPassG1.connect(addrs[0]).whitelistMintRedeem(proof, {
        value: MINT_PRICE_WEI,
      });
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
      const tx = await collectorsPassG1.connect(addrs[0]).whitelistMintRedeem(proof, {
        value: MINT_PRICE_WEI,
      });
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
        await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        });
        expect(await collectorsPassG1.totalSupply()).to.equal(i + 1);
      }
    });
    it("returns correct token by index", async () => {
      for (const a of addrs.slice(0, MAX_SUPPLY)) {
        const k = keccak256(a.address).toString("hex");
        const proof = merkleGenerateOutput.proof[k];
        await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        });
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
        await collectorsPassG1.connect(a).whitelistMintRedeem(proof, {
          value: MINT_PRICE_WEI,
        });
      }
      for (const [i, a] of addrs.slice(0, MAX_SUPPLY).entries()) {
        // (... - i + 1) => because contract counter '_tokenIds' starts at 1
        expect(await collectorsPassG1.tokenOfOwnerByIndex(a.address, 0)).to.equal(MAX_SUPPLY - 1 - i + 1);
      }
    });
  });
});
