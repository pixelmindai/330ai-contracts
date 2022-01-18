// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

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

contract CollectorsPassG1 is ERC721URIStorage, ERC721Enumerable, MerkleValidator, Ownable, Pausable {
    // Use OpenZeppelin's Counters to generate token ids.
    using Counters for Counters.Counter;

    // ============ Immutable Storage ============

    // The address that is able to withdraw funds.
    address payable public immutable beneficiaryAddress;
    // The maximum number of tokens this contract can create.
    uint256 public immutable maxSupply;
    // The price set to mint a token in Wei; must represent at least 0.1 ETH.
    uint256 public immutable mintPriceWei = 100000000000000000;
    // Timestamp representing beginning of whitelist mint window.
    uint256 public immutable whitelistNotBeforeTime;
    // Timestamp representing end of whitelist mint window.
    uint256 public immutable whitelistMintEndTime;

    // ============ Mutable Storage ============

    /**
     * In order to open minting to anyone, contract owner must
     * first call `setOpenMintActive()`, which sets `openMintActive`.
     */
    bool public openMintActive;
    /**
     * By calling `endAllMinting()`, value for `allMintingIsEnded` will
     * be set to `true`. Once set, this value cannot be unset,
     * and locks all remaining minting for the contract permanently.
     */
    bool public allMintingIsEnded;
    // Points to resource which returns token metadata.
    string public baseTokenURI;
    // Next token id to be set; initially incremented to `1`.
    Counters.Counter private _tokenIds;

    // ============ Events ============

    event PassClaimed();
    event OpenMintActivated();
    event OpenMintDeactivated();
    event AllMintingEnded();
    event ContractPaused();
    event ContractUnpaused();

    // ============ Errors ============

    /// Mint price set too low.
    error MintPriceTooLow();
    /// Caller has already claimed pass.
    error PassAlreadyClaimed();
    /// No pass available. Maximum supply has been reached.
    error MaxSupplyReached();
    /// Caller has sent incorrect amount of ETH.
    error IncorrectEthEmount();
    /// The whitelist mint is not yet active.
    error WhitelistMintNotStarted();
    /// The whitelist mint has not yet ended.
    error WhitelistMintNotEnded();
    /// The whitelist mint has ended.
    error WhitelistMintEnded();
    /// The open mint is not yet active.
    error OpenMintNotActive();
    /// All minting has been ended.
    error AllMintingAlreadyEnded();
    /// The function `endAllMinting()` has already been called.
    error EndAllMintingAlreadyCalled();
    /// Sender is not beneficiary
    error SenderNotBeneficiary();
    /// Owner cannot be beneficiary
    error OwnerCannotBeBeneficiary();
    /// Sender is not adminRecovery
    error SenderNotAdminRecovery();

    // ============ Modifiers ============

    modifier allMintingNotEnded() {
        if (allMintingIsEnded) revert AllMintingAlreadyEnded();
        _;
    }

    modifier whitelistMintActive() {
        if (block.timestamp < whitelistNotBeforeTime) revert WhitelistMintNotStarted();
        if (block.timestamp > whitelistMintEndTime) revert WhitelistMintEnded();
        _;
    }

    modifier whitelistMintEnded() {
        if (block.timestamp < whitelistMintEndTime) revert WhitelistMintNotEnded();
        _;
    }

    modifier openMintingActive() {
        if (!openMintActive) revert OpenMintNotActive();
        _;
    }

    modifier notAlreadyClaimed() {
        if (ERC721.balanceOf(msg.sender) > 0) revert PassAlreadyClaimed();
        _;
    }

    modifier maxSupplyNotReached() {
        if (totalSupply() >= maxSupply) revert MaxSupplyReached();
        _;
    }

    modifier costs(uint256 price) {
        if (msg.value != price) revert IncorrectEthEmount();
        _;
    }

    modifier onlyBeneficiary() {
        if (msg.sender != beneficiaryAddress) revert SenderNotBeneficiary();
        _;
    }

    // ============ Constructor ============

    constructor(
        string memory baseTokenURI_,
        uint256 maxSupply_,
        bytes32 merkleroot_,
        uint256 whitelistNotBeforeTime_,
        uint256 whitelistMintDurationSeconds,
        address payable beneficiaryAddress_
    ) ERC721("Pixelmind Collector's Pass", "PX PASS") MerkleValidator(merkleroot_) {
        if (beneficiaryAddress_ == msg.sender) revert OwnerCannotBeBeneficiary();
        baseTokenURI = baseTokenURI_;
        maxSupply = maxSupply_;
        whitelistNotBeforeTime = whitelistNotBeforeTime_;
        whitelistMintEndTime = whitelistNotBeforeTime_ + whitelistMintDurationSeconds;
        beneficiaryAddress = beneficiaryAddress_;
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

    // ============ Redeem ============

    function whitelistMintRedeem(bytes32[] calldata proof)
        external
        payable
        whenNotPaused
        allMintingNotEnded
        whitelistMintActive
        senderWhitelisted(proof)
        costs(mintPriceWei)
    {
        _redeem();
    }

    function openMintRedeem() external payable whenNotPaused allMintingNotEnded openMintingActive costs(mintPriceWei) {
        _redeem();
    }

    // ============ Private Functions ============

    function _redeem() private notAlreadyClaimed maxSupplyNotReached {
        uint256 tokenId = 420 + _tokenIds.current();
        _tokenIds.increment();
        _safeMint(msg.sender, tokenId);
        emit PassClaimed();
    }

    // ============ Owner Functions ============

    function setOpenMintActive() external onlyOwner whenNotPaused whitelistMintEnded {
        openMintActive = true;
        emit OpenMintActivated();
    }

    function endAllMinting() external onlyOwner whitelistMintEnded {
        if (allMintingIsEnded) revert EndAllMintingAlreadyCalled();
        allMintingIsEnded = true;
        emit AllMintingEnded();
    }

    // ============ Beneficiary Functions ============

    function withdraw() external onlyBeneficiary whenNotPaused {
        beneficiaryAddress.transfer(address(this).balance);
    }

    // ============ Admin Functions ============

    function pauseContract() external onlyOwner {
        _pause();
        emit Paused(msg.sender);
    }

    function unpauseContract() external onlyOwner {
        _unpause();
        emit Unpaused(msg.sender);
    }

    function recoverEth() external onlyOwner whenPaused {
        payable(owner()).transfer(address(this).balance);
    }

    // ============ Miscellaneous Public and External ============

    function checkWhitelistRedeem(bytes32[] calldata proof)
        external
        view
        whenNotPaused
        allMintingNotEnded
        whitelistMintActive
        senderWhitelisted(proof)
        notAlreadyClaimed
        maxSupplyNotReached
        returns (bool)
    {
        return true;
    }

    function checkOpenRedeem()
        external
        view
        whenNotPaused
        allMintingNotEnded
        openMintingActive
        notAlreadyClaimed
        maxSupplyNotReached
        returns (bool)
    {
        return true;
    }
}
