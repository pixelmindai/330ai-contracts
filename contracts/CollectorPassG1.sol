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
    uint256 public immutable maxSupply;
    bytes32 public immutable root;

    constructor(
        string memory baseURI,
        uint256 maxTokens,
        bytes32 merkleroot
    ) ERC721("Pixelmind Collectors Pass G1", "PIXELMIND C.G1") {
        baseTokenURI = baseURI;
        maxSupply = maxTokens;
        root = merkleroot;
    }

    function setBaseURI(string memory baseURI) external onlyOwner {
        baseTokenURI = baseURI;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }


    function redeem(address account, bytes32[] calldata proof)
    external
    {
        require(_verify(_leaf(account), proof), "Invalid merkle proof");
        require(ERC721.balanceOf(account) < 1, "User already has a pass");
        require(_tokenIdCounter.current() + 1 < MAXSUPPLY, "There are no more passes to redeem");  
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(account, tokenId);
    }

    function checkRedeem(address account, bytes32[] calldata proof) public view returns (bool){
        require(_verify(_leaf(account), proof), "Invalid merkle proof");
        require(ERC721.balanceOf(account) < 1, "User already has a pass");
        require(_tokenIdCounter.current() + 1 < MAXSUPPLY, "There are no more passes to redeem");  
       
        return _verify(_leaf(account), proof);
    }

    function _leaf(address account)
    internal pure returns (bytes32)
    {
        return keccak256(abi.encodePacked(account));
    }

    function _verify(bytes32 leaf, bytes32[] memory proof)
    internal view returns (bool)
    {
        return MerkleProof.verify(proof, root, leaf);
    }
}
