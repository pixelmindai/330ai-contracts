// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MerkleValidator {
    // The root of Merkle tree for all whitelisted addresses.
    bytes32 public immutable merkleroot;

    /// Caller not whitelisted or invalid Merkle proof provided.
    error InvalidMerkleProof(address caller);

    // Verifies `msg.sender` address to see if valid leaf node of `merkleroot`.
    modifier senderWhitelisted(bytes32[] calldata proof) {
        if (!_verify(_leaf(msg.sender), proof)) revert InvalidMerkleProof({ caller: msg.sender });
        _;
    }

    constructor(bytes32 merkleroot_) {
        merkleroot = merkleroot_;
    }

    // Returns `keccak256` hash of provided address.
    function _leaf(address account) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(account));
    }

    // Verifies `proof` to see if `leaf` valid node of `merkleroot`.
    function _verify(bytes32 leaf, bytes32[] memory proof) internal view returns (bool) {
        return MerkleProof.verify(proof, merkleroot, leaf);
    }
}
