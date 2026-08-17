// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TillAgentNFT} from "./TillAgentNFT.sol";
import {TillPolicy} from "./TillPolicy.sol";
import {TillVerifier} from "./TillVerifier.sol";

interface ITillJobEscrow {
    function lockFromVault(bytes32 jobId, uint256 tokenId, address payee, uint256 amount, uint64 deadline)
        external;
}

/// @title TillVault
/// @notice Per-token native 0G balances. Executor cannot withdraw, set policy, or change ownership.
contract TillVault is ReentrancyGuard {
    TillAgentNFT public immutable nft;
    TillPolicy public immutable policy;
    TillVerifier public immutable verifier;
    ITillJobEscrow public escrow;

    address public immutable admin;

    mapping(uint256 => uint256) public available;
    mapping(uint256 => uint256) public locked;
    mapping(uint256 => mapping(uint256 => bool)) public usedNonces;

    bytes4 public constant RELEASE_SELECTOR = bytes4(keccak256("release(uint256,address,uint256,bytes32,uint256)"));
    bytes4 public constant LOCK_SELECTOR = bytes4(keccak256("lockToJob(bytes32,uint256,address,uint256,bytes32,uint256,uint64)"));

    error ZeroAddress();
    error ZeroAmount();
    error OnlyAdmin();
    error OnlyOwner();
    error OnlyExecutor();
    error OnlyEscrow();
    error EscrowAlreadySet();
    error InsufficientAvailable();
    error NonceUsed();
    error EvidenceRequired();
    error TransferFailed();
    error TeeRequired();

    event Deposited(uint256 indexed tokenId, address indexed from, uint256 amount, uint256 availableAfter);
    event Withdrawn(uint256 indexed tokenId, address indexed to, uint256 amount, uint256 availableAfter);
    event Released(
        uint256 indexed tokenId,
        address indexed executor,
        address indexed to,
        uint256 amount,
        bytes32 resourceHash,
        uint256 nonce
    );
    event IntentDenied(uint256 indexed tokenId, uint256 nonce, string reason);
    event JobLocked(bytes32 indexed jobId, uint256 indexed tokenId, uint256 amount);
    event CreditRefund(uint256 indexed tokenId, uint256 amount, uint256 availableAfter);
    event PacketAnchored(uint256 indexed tokenId, bytes32 indexed rootHash);
    event EscrowBound(address indexed escrow);

    constructor(TillAgentNFT nft_, TillPolicy policy_, TillVerifier verifier_) {
        nft = nft_;
        policy = policy_;
        verifier = verifier_;
        admin = msg.sender;
    }

    function setEscrow(address escrow_) external {
        if (msg.sender != admin) revert OnlyAdmin();
        if (escrow_ == address(0)) revert ZeroAddress();
        if (address(escrow) != address(0)) revert EscrowAlreadySet();
        escrow = ITillJobEscrow(escrow_);
        emit EscrowBound(escrow_);
    }

    function deposit(uint256 tokenId) external payable nonReentrant {
        nft.ownerOf(tokenId);
        if (msg.value == 0) revert ZeroAmount();
        available[tokenId] += msg.value;
        emit Deposited(tokenId, msg.sender, msg.value, available[tokenId]);
    }

    receive() external payable {
        revert ZeroAmount();
    }

    function withdraw(uint256 tokenId, uint256 amount) external nonReentrant {
        if (nft.ownerOf(tokenId) != msg.sender) revert OnlyOwner();
        if (amount == 0) revert ZeroAmount();
        if (available[tokenId] < amount) revert InsufficientAvailable();
        available[tokenId] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(tokenId, msg.sender, amount, available[tokenId]);
    }

    function release(
        uint256 tokenId,
        address to,
        uint256 amount,
        bytes32 resourceHash,
        uint256 nonce,
        bytes calldata modelResponse,
        bytes calldata teeSignature
    ) external nonReentrant {
        _requireExecutor(tokenId);
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (usedNonces[tokenId][nonce]) revert NonceUsed();
        if (available[tokenId] < amount) revert InsufficientAvailable();
        usedNonces[tokenId][nonce] = true;
        available[tokenId] -= amount;

        (bool requireTee, bool requireEvidence) =
            policy.enforceAndCharge(tokenId, to, amount, resourceHash, RELEASE_SELECTOR);

        if (requireTee) {
            TillVerifier.SpendIntent memory intent = TillVerifier.SpendIntent({
                tokenId: tokenId,
                nonce: nonce,
                target: to,
                amount: amount,
                resourceHash: resourceHash,
                allow: true
            });
            verifier.verifyAllow(intent, modelResponse, teeSignature);
        }
        if (requireEvidence && modelResponse.length == 0) revert EvidenceRequired();

        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Released(tokenId, msg.sender, to, amount, resourceHash, nonce);
    }

    function lockToJob(
        bytes32 jobId,
        uint256 tokenId,
        address payee,
        uint256 amount,
        bytes32 resourceHash,
        uint256 nonce,
        uint64 deadline,
        bytes calldata modelResponse,
        bytes calldata teeSignature
    ) external nonReentrant {
        _requireExecutor(tokenId);
        if (payee == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (address(escrow) == address(0)) revert ZeroAddress();
        if (usedNonces[tokenId][nonce]) revert NonceUsed();
        if (available[tokenId] < amount) revert InsufficientAvailable();
        usedNonces[tokenId][nonce] = true;
        available[tokenId] -= amount;
        locked[tokenId] += amount;

        (bool requireTee,) =
            policy.enforceAndCharge(tokenId, payee, amount, resourceHash, LOCK_SELECTOR);

        if (requireTee) {
            TillVerifier.SpendIntent memory intent = TillVerifier.SpendIntent({
                tokenId: tokenId,
                nonce: nonce,
                target: payee,
                amount: amount,
                resourceHash: resourceHash,
                allow: true
            });
            verifier.verifyAllow(intent, modelResponse, teeSignature);
        }

        (bool sent,) = address(escrow).call{value: amount}("");
        if (!sent) revert TransferFailed();
        escrow.lockFromVault(jobId, tokenId, payee, amount, deadline);
        emit JobLocked(jobId, tokenId, amount);
    }

    function settleCredit(uint256 tokenId, uint256 amount) external {
        if (msg.sender != address(escrow)) revert OnlyEscrow();
        if (locked[tokenId] < amount) revert InsufficientAvailable();
        locked[tokenId] -= amount;
    }

    function refundCredit(uint256 tokenId) external payable {
        if (msg.sender != address(escrow)) revert OnlyEscrow();
        if (msg.value == 0) revert ZeroAmount();
        if (locked[tokenId] < msg.value) revert InsufficientAvailable();
        locked[tokenId] -= msg.value;
        available[tokenId] += msg.value;
        emit CreditRefund(tokenId, msg.value, available[tokenId]);
    }

    function anchorPacket(uint256 tokenId, bytes32 rootHash) external {
        _requireExecutor(tokenId);
        emit PacketAnchored(tokenId, rootHash);
    }

    function _requireExecutor(uint256 tokenId) internal view {
        if (!nft.isUsageAuthorized(tokenId, msg.sender)) revert OnlyExecutor();
    }
}
