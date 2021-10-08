// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./utils/MerkelValidator.sol";

contract AwakeningSeries is ERC721, MerkelValidator {
    uint256 mintDeadline = block.timestamp + 7 days;
    // using zero address for now
    address public constant treasury = 0x0000000000000000000000000000000000000000;

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    /**
     * @notice Constructor which primarily used to set the base url and setting all nft's for sale
     **/
    constructor(bytes32 _merkleRoot) ERC721("Awakening", "AWAKENING") MerkelValidator(_merkleRoot) {}

    /**
     * @notice Mints Awakening Series NFT
     /// @param index Merkle Proof User Index
     /// @param merkleProof Merkle Proof User Proof Array
     /// These details will be available when merkel root is generated
     * @return _tokenId token id
     */
    function mint(uint256 index, bytes32[] calldata merkleProof) external returns (uint256) {
        require(block.timestamp < mintDeadline, "Minting Over");
        verify(index, msg.data, true, merkleProof);
        uint256 id = _tokenIds.current();
        _tokenIds.increment();
        _mint(msg.sender, id);
        return id;
    }

    /**
     * @notice returns the tokenURI of the nft
     * @param _tokenId token id
     */
    function tokenURI(uint256 _tokenId) public pure override returns (string memory) {
        require(_tokenId >= 0, "Invalid ID");
        // since the url is not finallized so leaving it as it is right now
        return ("https://ipfs.io/ipfs/hash");
    }
}
