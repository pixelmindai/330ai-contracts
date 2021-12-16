// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract CollectorPassG1 is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    string public baseTokenURI;
    string public _tokenURI;
    uint256 public immutable maxSupply;
    bytes32 public immutable root;

    constructor(
        string memory baseURI,
        string memory tokenSegmentURI,
        uint256 maxTokens,
        bytes32 merkleroot
    ) ERC721("Pixelmind Collectors Pass G1", "PIXELMIND C.G1") {
        baseTokenURI = baseURI;
        _tokenURI = tokenSegmentURI;
        maxSupply = maxTokens;
        root = merkleroot;
    }

    function setBaseURI(string memory baseURI) external onlyOwner {
        baseTokenURI = baseURI;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, _tokenURI)) : "";
    }

    modifier canRedeem(bytes32[] calldata proof) {
        require(_verify(_leaf(msg.sender), proof), "Invalid merkle proof");
        require(ERC721.balanceOf(msg.sender) < 1, "User already has a pass");
        require(_tokenIds.current() + 1 < maxSupply, "There are no more passes to redeem");
        _;
    }

    function redeem(bytes32[] calldata proof) external canRedeem(proof) {
        uint256 tokenId = _tokenIds.current();
        _tokenIds.increment();
        _safeMint(msg.sender, tokenId);
    }

    function checkRedeem(bytes32[] calldata proof) external view canRedeem(proof) returns (bool) {
        return true;
    }

    function _leaf(address account) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(account));
    }

    function _verify(bytes32 leaf, bytes32[] memory proof) internal view returns (bool) {
        return MerkleProof.verify(proof, root, leaf);
    }
}
