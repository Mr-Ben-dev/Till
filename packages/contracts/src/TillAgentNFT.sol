// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/interfaces/IERC721.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {IERC7857} from "./vendor/erc7857/IERC7857.sol";
import {IERC7857Authorize} from "./vendor/erc7857/IERC7857Authorize.sol";
import {IERC7857Cloneable} from "./vendor/erc7857/IERC7857Cloneable.sol";
import {IntelligentData} from "./vendor/erc7857/IERC7857Metadata.sol";
import {IERC7857DataVerifier, TransferValidityProof} from "./vendor/erc7857/IERC7857DataVerifier.sol";
import {SealedKeyEntry} from "./vendor/erc7857/IERC7857.sol";

interface ITillVaultBalance {
    function available(uint256 tokenId) external view returns (uint256);
    function locked(uint256 tokenId) external view returns (uint256);
}

/// @title TillAgentNFT
/// @notice Per-user Agentic ID. Official IERC7857 + Authorize + Cloneable ABI.
///         Foundation sealed-key attestor is Galileo-only — iTransferFrom / iCloneFrom
///         revert SealedKeyAttestorUnavailable instead of faking a proof.
contract TillAgentNFT is ERC721, IERC7857Authorize, IERC7857Cloneable {
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 public constant MAX_AUTHORIZED_USERS = 100;

    uint256 private _nextId = 1;
    address public vault;
    address public immutable deployer;

    mapping(uint256 => EnumerableSet.AddressSet) private _authorized;
    mapping(uint256 => IntelligentData[]) private _data;

    error ZeroAddress();
    error NotTokenOwner();
    error VaultAlreadySet();
    error SealedKeyAttestorUnavailable();
    error TillNotEmpty();
    error NotAuthorizedExecutor();

    event VaultBound(address indexed vault);
    event TillMinted(address indexed owner, uint256 indexed tokenId);

    constructor() ERC721("Till Agent", "TILLID") {
        deployer = msg.sender;
    }

    function setVault(address vault_) external {
        if (msg.sender != deployer) revert NotTokenOwner();
        if (vault_ == address(0)) revert ZeroAddress();
        if (vault != address(0)) revert VaultAlreadySet();
        vault = vault_;
        emit VaultBound(vault_);
    }

    function mint() external returns (uint256 tokenId) {
        tokenId = _nextId++;
        _safeMint(msg.sender, tokenId);
        _data[tokenId].push(
            IntelligentData({
                dataDescription: "till-vault-binding",
                dataHash: keccak256(abi.encode(address(this), tokenId, vault))
            })
        );
        emit TillMinted(msg.sender, tokenId);
    }

    function isUsageAuthorized(uint256 tokenId, address user) public view returns (bool) {
        if (user == address(0)) return false;
        if (_ownerOf(tokenId) == user) return true;
        return _authorized[tokenId].contains(user);
    }

    function requireExecutor(uint256 tokenId, address user) external view {
        if (!isUsageAuthorized(tokenId, user)) revert NotAuthorizedExecutor();
    }

    // ── IERC7857Authorize ────────────────────────────────────────────────────

    function authorizeUsage(uint256 tokenId, address user) public {
        if (user == address(0)) revert ERC7857InvalidAuthorizedUser(user);
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        _authorizeUser(tokenId, user);
    }

    function batchAuthorizeUsage(uint256 tokenId, address[] calldata users) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == address(0)) revert ERC7857InvalidAuthorizedUser(users[i]);
            _authorizeUser(tokenId, users[i]);
        }
    }

    function revokeAuthorization(uint256 tokenId, address user) public {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (user == address(0)) revert ERC7857InvalidAuthorizedUser(user);
        if (!_authorized[tokenId].remove(user)) revert ERC7857NotAuthorized();
        emit AuthorizationRevoked(msg.sender, user, tokenId);
    }

    function clearAuthorizedUsers(uint256 tokenId) public {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        _clearAuthorized(tokenId);
        emit AuthorizationCleared(msg.sender, tokenId);
    }

    function authorizedUsersOf(uint256 tokenId) public view returns (address[] memory) {
        ownerOf(tokenId);
        return _authorized[tokenId].values();
    }

    function _authorizeUser(uint256 tokenId, address user) internal {
        EnumerableSet.AddressSet storage set = _authorized[tokenId];
        if (set.length() >= MAX_AUTHORIZED_USERS) revert ERC7857TooManyAuthorizedUsers();
        if (set.contains(user)) revert ERC7857AlreadyAuthorized();
        set.add(user);
        emit AuthorizationGranted(msg.sender, user, tokenId);
    }

    function _clearAuthorized(uint256 tokenId) internal {
        address[] memory values = _authorized[tokenId].values();
        for (uint256 i = 0; i < values.length; i++) {
            _authorized[tokenId].remove(values[i]);
        }
    }

    // ── IERC7857 ─────────────────────────────────────────────────────────────

    function verifier() external pure returns (IERC7857DataVerifier) {
        return IERC7857DataVerifier(address(0));
    }

    function intelligentDatasOf(uint256 tokenId) external view returns (IntelligentData[] memory) {
        ownerOf(tokenId);
        return _data[tokenId];
    }

    function iTransferFrom(address, address, uint256, TransferValidityProof[] calldata)
        external
        pure
        returns (SealedKeyEntry[] memory)
    {
        revert SealedKeyAttestorUnavailable();
    }

    function iCloneFrom(address, address, uint256, TransferValidityProof[] calldata)
        external
        pure
        returns (uint256)
    {
        revert SealedKeyAttestorUnavailable();
    }

    function transferFrom(address, address, uint256) public pure override(ERC721, IERC721) {
        revert ERC7857UseITransferFrom();
    }

    function safeTransferFrom(address, address, uint256, bytes memory)
        public
        pure
        override(ERC721, IERC721)
    {
        revert ERC7857UseITransferFrom();
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert ERC7857UseITransferFrom();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert ERC7857UseITransferFrom();
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) {
            if (vault != address(0)) {
                uint256 avail = ITillVaultBalance(vault).available(tokenId);
                uint256 lock = ITillVaultBalance(vault).locked(tokenId);
                if (avail + lock != 0) revert TillNotEmpty();
            }
            _clearAuthorized(tokenId);
        }
        return from;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC7857).interfaceId
            || interfaceId == type(IERC7857Authorize).interfaceId
            || interfaceId == type(IERC7857Cloneable).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
