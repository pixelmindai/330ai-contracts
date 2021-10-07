// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts/utils/Counters.sol";

contract AwakeningSeries is ERC721 {
    // using zero address for now
    address public constant treasury = 0x0000000000000000000000000000000000000000;
    // weth poygon address
    IERC20 public constant weth = IERC20(0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619);
    // 0.033 weth
    uint256 public constant price = 33000000000000000;
    uint256 public constant totalItems = 3300;
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    /**
     * @notice Constructor which primarily used to set the base url and setting all nft's for sale
     **/
    constructor() ERC721("Awakening", "AWAKENING") {}

    /**
     * @notice Mints Awakening Series NFT
     * @return _tokenId token id
     */
    function mint() external returns (uint256) {
        uint256 id = _tokenIds.current();
        require(id < totalItems, "No Items left to mint");
        _tokenIds.increment();
        _mint(msg.sender, id);
        // alllowance needed prior to the transaction
        weth.transferFrom(msg.sender, treasury, price);
        return id;
    }

    /**
     * @notice returns the tokenURI of the nft
     * @param _tokenId token id
     */
    function tokenURI(uint256 _tokenId) public pure override returns (string memory) {
        require(_tokenId < totalItems, "Invalid ID");
        require(_tokenId >= 0, "Invalid ID");
        // since the url is not finallized so leaving it as it is right now
        return ("https://ipfs.io/ipfs/hash");
    }
}
