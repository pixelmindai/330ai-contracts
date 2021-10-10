// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./utils/MerkelValidator.sol";

contract AwakeningSeries is ERC721, MerkelValidator, Ownable {
    uint256 mintDeadline = block.timestamp + 7 days;
    // using zero address for now
    address public constant treasury = 0x0000000000000000000000000000000000000000;
    string public baseTokenURI;

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    /**
     * @notice Constructor which primarily used to set the base url and setting all nft's for sale
     **/
    constructor(bytes32 _merkleRoot) ERC721("Awakening", "AWAKENING") MerkelValidator(_merkleRoot) {
        setBaseURI("hosted_webserver_endpoint");
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
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_tokenId >= 0, "Invalid ID");
        return strConcat(_baseURI(), uintToStr(_tokenId));
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

    /**
     * @notice Convert a `uint` value to a `string`
     * via OraclizeAPI - MIT licence
     * https://github.com/provable-things/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol#L896
     * @param _i the `uint` value to be converted
     * @return result the `string` representation of the given `uint` value
     */
    function uintToStr(uint256 _i) internal pure returns (string memory result) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len - 1;
        while (_i != 0) {
            bstr[k--] = bytes1(uint8(48 + (_i % 10)));
            _i /= 10;
        }
        result = string(bstr);
    }
}
