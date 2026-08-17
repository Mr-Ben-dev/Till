// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TillAgentNFT} from "./TillAgentNFT.sol";
import {TillVault} from "./TillVault.sol";

/// @title TillJobEscrow
/// @notice Paid Result: lock → settle to payee, or refund to the same Till.
contract TillJobEscrow is ReentrancyGuard {
    struct Job {
        uint256 tokenId;
        address payee;
        uint256 amount;
        uint64 deadline;
        bool settled;
        bool refunded;
    }

    TillVault public immutable vault;
    TillAgentNFT public immutable nft;

    mapping(bytes32 => Job) public jobs;

    error OnlyVault();
    error OnlyOwner();
    error OnlyExecutor();
    error AlreadyExists();
    error UnknownJob();
    error AlreadyDone();
    error DeadlineNotReached();
    error TransferFailed();
    error ZeroAmount();

    event JobOpened(bytes32 indexed jobId, uint256 indexed tokenId, address payee, uint256 amount, uint64 deadline);
    event JobSettled(bytes32 indexed jobId, uint256 indexed tokenId, address payee, uint256 amount);
    event JobRefunded(bytes32 indexed jobId, uint256 indexed tokenId, uint256 amount);

    constructor(TillVault vault_, TillAgentNFT nft_) {
        vault = vault_;
        nft = nft_;
    }

    function lockFromVault(bytes32 jobId, uint256 tokenId, address payee, uint256 amount, uint64 deadline)
        external
    {
        if (msg.sender != address(vault)) revert OnlyVault();
        if (jobs[jobId].amount != 0 || jobs[jobId].payee != address(0)) revert AlreadyExists();
        if (amount == 0) revert ZeroAmount();
        jobs[jobId] = Job({
            tokenId: tokenId,
            payee: payee,
            amount: amount,
            deadline: deadline,
            settled: false,
            refunded: false
        });
        emit JobOpened(jobId, tokenId, payee, amount, deadline);
    }

    function settle(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.amount == 0) revert UnknownJob();
        if (job.settled || job.refunded) revert AlreadyDone();
        if (!nft.isUsageAuthorized(job.tokenId, msg.sender)) revert OnlyExecutor();

        job.settled = true;
        vault.settleCredit(job.tokenId, job.amount);
        (bool ok,) = job.payee.call{value: job.amount}("");
        if (!ok) revert TransferFailed();
        emit JobSettled(jobId, job.tokenId, job.payee, job.amount);
    }

    /// @notice Owner may refund anytime. Executor may refund. Anyone may refund after deadline.
    function refund(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.amount == 0) revert UnknownJob();
        if (job.settled || job.refunded) revert AlreadyDone();

        address owner_ = nft.ownerOf(job.tokenId);
        bool isOwner = msg.sender == owner_;
        bool isExec = nft.isUsageAuthorized(job.tokenId, msg.sender);
        bool timedOut = job.deadline != 0 && block.timestamp >= job.deadline;
        if (!isOwner && !isExec && !timedOut) revert OnlyOwner();

        job.refunded = true;
        vault.refundCredit{value: job.amount}(job.tokenId);
        emit JobRefunded(jobId, job.tokenId, job.amount);
    }

    receive() external payable {}
}
