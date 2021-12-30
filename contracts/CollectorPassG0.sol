// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract CollectorsPassG0 is ERC721URIStorage, ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    string public baseTokenURI;
    uint256 public immutable maxSupply;
    bytes32 public immutable root;

    constructor(
        string memory baseURI,
        uint256 maxTokens,
        bytes32 merkleroot
    ) ERC721("Pixelmind Collector's Pass", "PX PASS") {
        baseTokenURI = baseURI;
        maxSupply = maxTokens;
        root = merkleroot;
        _tokenIds.increment();
    }

    function setBaseURI(string memory baseURI) external onlyOwner {
        baseTokenURI = baseURI;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view virtual override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    modifier canRedeem(bytes32[] calldata proof) {
        require(_verify(_leaf(msg.sender), proof), "Invalid merkle proof");
        require(ERC721.balanceOf(msg.sender) < 1, "User already has a pass");
        require(totalSupply() < maxSupply, "There are no more passes to redeem");
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
