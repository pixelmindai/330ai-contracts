// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./utils/MerkelValidator.sol";

contract AwakeningSeries is ERC721, MerkelValidator, Ownable {
    using Strings for uint256;
    uint256 private mintDeadline;
    string public baseTokenURI;

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    /**
     * @notice Constructor which primarily used to set the base url and setting all nft's for sale
     **/
    constructor(
        bytes32 _merkleRoot,
        uint256 _mintDeadline,
        string memory _baseTokenURI
    ) ERC721("Awakening", "AWAKENING") MerkelValidator(_merkleRoot) {
        mintDeadline = _mintDeadline;
        setBaseURI(_baseTokenURI);
    }

    /**
     * @notice Returns the current Base URI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    /**
     * @notice Allows owner to update the base url
    /// @param baseURI New Base URI
    */
    function setBaseURI(string memory baseURI) public onlyOwner {
        baseTokenURI = baseURI;
    }

    /**
     * @notice Mints Awakening Series NFT
     /// @param index Merkle Proof User Index
     /// @param merkleProof Merkle Proof User Proof Array
     /// @param _data CallData of function
     /// These details will be available when merkel root is generated
     * @return _tokenId token id
     */
    function mint(
        uint256 index,
        bytes32[] calldata merkleProof,
        bytes calldata _data
    ) external returns (uint256) {
        require(block.timestamp < mintDeadline, "AwakeningSeries: Minting Over");
        verify(index, _data, true, merkleProof);
        uint256 id = _tokenIds.current();
        _tokenIds.increment();
        _mint(msg.sender, id);
        return id;
    }

    /**
     * @notice returns the tokenURI of the nft
     * @param _tokenId token id
     */
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        return strConcat(_baseURI(), Strings.toString(_tokenId));
    }

    /**
     * @notice Concatenate two strings
     * @param _a the first string
     * @param _b the second string
     * @return result the concatenation of `_a` and `_b`
     */
    function strConcat(string memory _a, string memory _b) internal pure returns (string memory result) {
        result = string(abi.encodePacked(bytes(_a), bytes(_b)));
    }
}
