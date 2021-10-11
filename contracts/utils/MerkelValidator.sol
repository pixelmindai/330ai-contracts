pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./IMerkleValidator.sol";

contract MerkelValidator is IMerkleValidator {
    bytes32 public immutable override merkleRoot;

    /// @param _merkleRoot Merkle root for the game
    constructor(bytes32 _merkleRoot) {
        merkleRoot = _merkleRoot;
    }

    /// @notice Responsible for validating player merkle proof
    /// @param index Merkle Proof Player Index
    /// @param data user specifc calldata to verify minting
    /// @param isValid Bool Flag
    /// @param merkleProof Merkle proof of the player
    function verify(
        uint256 index,
        bytes memory data,
        bool isValid,
        bytes32[] calldata merkleProof
    ) public view override {
        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(index, data, isValid));
        require(MerkleProof.verify(merkleProof, merkleRoot, node), "MerkelValidator: Invalid proof");
    }
}
