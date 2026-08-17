// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TillAgentNFT} from "./TillAgentNFT.sol";

/// @title TillPolicy
/// @notice Per-Till hard constraints. Owner-only setters. Executor cannot change policy.
contract TillPolicy {
    struct Policy {
        uint128 maxSpendPerTx;
        uint128 rollingWindowBudget;
        uint64 rollingWindowSeconds;
        uint64 sessionExpiresAt;
        uint64 windowStart;
        uint128 windowSpent;
        bool paused;
        bool requireTee;
        bool requireEvidence;
        bool targetAllowlistEnabled;
        bool resourceAllowlistEnabled;
        bool selectorAllowlistEnabled;
    }

    TillAgentNFT public immutable nft;

    mapping(uint256 => Policy) internal _policies;
    mapping(uint256 => mapping(address => bool)) public allowedTargets;
    mapping(uint256 => mapping(bytes32 => bool)) public allowedResourceHashes;
    mapping(uint256 => mapping(bytes4 => bool)) public allowedSelectors;

    error NotOwner();
    error OnlyVault();
    error BadWindow();
    error Paused();
    error SessionExpired();
    error CapExceeded();
    error WindowExceeded();
    error TargetNotAllowed();
    error ResourceNotAllowed();
    error SelectorNotAllowed();
    error ZeroToken();

    event PolicySet(
        uint256 indexed tokenId,
        uint128 maxSpendPerTx,
        uint128 rollingWindowBudget,
        uint64 rollingWindowSeconds,
        uint64 sessionExpiresAt,
        bool requireTee,
        bool requireEvidence
    );
    event PauseSet(uint256 indexed tokenId, bool paused);
    event TargetAllowlistUpdated(uint256 indexed tokenId, address indexed target, bool allowed);
    event ResourceAllowlistUpdated(uint256 indexed tokenId, bytes32 indexed resourceHash, bool allowed);
    event SelectorAllowlistUpdated(uint256 indexed tokenId, bytes4 indexed selector, bool allowed);
    event AllowlistModeSet(
        uint256 indexed tokenId, bool targets, bool resources, bool selectors
    );
    event WindowCharged(uint256 indexed tokenId, uint256 amount, uint256 windowSpent);

    constructor(TillAgentNFT nft_) {
        nft = nft_;
    }

    modifier onlyOwner(uint256 tokenId) {
        if (nft.ownerOf(tokenId) != msg.sender) revert NotOwner();
        _;
    }

    function policyOf(uint256 tokenId) external view returns (Policy memory) {
        return _policies[tokenId];
    }

    function setPolicy(
        uint256 tokenId,
        uint128 maxSpendPerTx,
        uint128 rollingWindowBudget,
        uint64 rollingWindowSeconds,
        uint64 sessionExpiresAt,
        bool requireTee,
        bool requireEvidence
    ) external onlyOwner(tokenId) {
        if (rollingWindowSeconds == 0) revert BadWindow();
        Policy storage p = _policies[tokenId];
        p.maxSpendPerTx = maxSpendPerTx;
        p.rollingWindowBudget = rollingWindowBudget;
        p.rollingWindowSeconds = rollingWindowSeconds;
        p.sessionExpiresAt = sessionExpiresAt;
        p.requireTee = requireTee;
        p.requireEvidence = requireEvidence;
        p.windowStart = uint64(block.timestamp);
        p.windowSpent = 0;
        emit PolicySet(
            tokenId,
            maxSpendPerTx,
            rollingWindowBudget,
            rollingWindowSeconds,
            sessionExpiresAt,
            requireTee,
            requireEvidence
        );
    }

    function setPaused(uint256 tokenId, bool paused_) external onlyOwner(tokenId) {
        _policies[tokenId].paused = paused_;
        emit PauseSet(tokenId, paused_);
    }

    function setAllowlistMode(uint256 tokenId, bool targets, bool resources, bool selectors)
        external
        onlyOwner(tokenId)
    {
        Policy storage p = _policies[tokenId];
        p.targetAllowlistEnabled = targets;
        p.resourceAllowlistEnabled = resources;
        p.selectorAllowlistEnabled = selectors;
        emit AllowlistModeSet(tokenId, targets, resources, selectors);
    }

    function setAllowedTarget(uint256 tokenId, address target, bool allowed) external onlyOwner(tokenId) {
        if (target == address(0)) revert ZeroToken();
        allowedTargets[tokenId][target] = allowed;
        emit TargetAllowlistUpdated(tokenId, target, allowed);
    }

    function setAllowedResource(uint256 tokenId, bytes32 resourceHash, bool allowed)
        external
        onlyOwner(tokenId)
    {
        allowedResourceHashes[tokenId][resourceHash] = allowed;
        emit ResourceAllowlistUpdated(tokenId, resourceHash, allowed);
    }

    function setAllowedSelector(uint256 tokenId, bytes4 selector, bool allowed) external onlyOwner(tokenId) {
        allowedSelectors[tokenId][selector] = allowed;
        emit SelectorAllowlistUpdated(tokenId, selector, allowed);
    }

    /// @notice Hard-policy gate used by the vault. Charges the rolling window on success.
    function enforceAndCharge(
        uint256 tokenId,
        address target,
        uint256 amount,
        bytes32 resourceHash,
        bytes4 selector
    ) external returns (bool requireTee, bool requireEvidence) {
        if (msg.sender != nft.vault()) revert OnlyVault();
        Policy storage p = _policies[tokenId];
        if (p.paused) revert Paused();
        if (p.rollingWindowSeconds == 0) revert BadWindow();
        if (p.sessionExpiresAt != 0 && block.timestamp >= p.sessionExpiresAt) revert SessionExpired();
        if (amount > p.maxSpendPerTx) revert CapExceeded();

        if (p.windowStart == 0 || block.timestamp >= uint256(p.windowStart) + uint256(p.rollingWindowSeconds)) {
            p.windowStart = uint64(block.timestamp);
            p.windowSpent = 0;
        }
        uint256 nextSpent = uint256(p.windowSpent) + amount;
        if (nextSpent > p.rollingWindowBudget) revert WindowExceeded();

        if (p.targetAllowlistEnabled && !allowedTargets[tokenId][target]) revert TargetNotAllowed();
        if (p.resourceAllowlistEnabled && !allowedResourceHashes[tokenId][resourceHash]) {
            revert ResourceNotAllowed();
        }
        if (p.selectorAllowlistEnabled && !allowedSelectors[tokenId][selector]) revert SelectorNotAllowed();

        p.windowSpent = uint128(nextSpent);
        emit WindowCharged(tokenId, amount, nextSpent);
        return (p.requireTee, p.requireEvidence);
    }

    /// @notice Revert-only preview (no window charge). Used by simulators / quote.
    function preview(uint256 tokenId, address target, uint256 amount, bytes32 resourceHash, bytes4 selector)
        external
        view
        returns (bool requireTee, bool requireEvidence)
    {
        Policy storage p = _policies[tokenId];
        if (p.paused) revert Paused();
        if (p.rollingWindowSeconds == 0) revert BadWindow();
        if (p.sessionExpiresAt != 0 && block.timestamp >= p.sessionExpiresAt) revert SessionExpired();
        if (amount > p.maxSpendPerTx) revert CapExceeded();

        uint256 spent = p.windowSpent;
        uint256 start = p.windowStart;
        if (start == 0 || block.timestamp >= uint256(start) + uint256(p.rollingWindowSeconds)) {
            spent = 0;
        }
        if (spent + amount > p.rollingWindowBudget) revert WindowExceeded();
        if (p.targetAllowlistEnabled && !allowedTargets[tokenId][target]) revert TargetNotAllowed();
        if (p.resourceAllowlistEnabled && !allowedResourceHashes[tokenId][resourceHash]) {
            revert ResourceNotAllowed();
        }
        if (p.selectorAllowlistEnabled && !allowedSelectors[tokenId][selector]) revert SelectorNotAllowed();
        return (p.requireTee, p.requireEvidence);
    }
}
