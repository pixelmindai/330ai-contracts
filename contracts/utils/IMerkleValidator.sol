pragma solidity >=0.8.4;

// Allows anyone to claim a token if they exist in a merkle root.
interface IMerkleValidator {
    // Returns the merkle root of the merkle tree containing account balances available to claim.
    function merkleRoot() external view returns (bytes32);

    // Verify users based on calldata
    function verify(
        uint256 index,
        bytes memory data,
        bool isValid,
        bytes32[] calldata merkleProof
    ) external view;
}
