// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Platinum is ERC721 {
    uint256 public constant totalItems = 10;
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    /**
     * @notice Constructor which primarily used to set the base url and setting all nft's for sale
     **/
    constructor() ERC721("Platinum", "PLATINUM") {}

    /**
     * @notice Mints Active Collector Membership NFT only 500 to be minted
     * @return _tokenId token id
     */
    function mint() external returns (uint256) {
        uint256 id = _tokenIds.current();
        require(id < totalItems, "No Items left to mint");
        _tokenIds.increment();
        _mint(msg.sender, id);
        return id;
    }

    /**
     * @notice returns the tokenURI of the nft
     * @param _tokenId token id
     */
    function tokenURI(uint256 _tokenId) public pure override returns (string memory) {
        require(_tokenId < totalItems, "Invalid ID");
        require(_tokenId >= 0, "Invalid ID");
        return ("https://ipfs.io/ipfs/hash");
    }
}
