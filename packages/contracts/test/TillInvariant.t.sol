// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TillAgentNFT} from "../src/TillAgentNFT.sol";
import {TillPolicy} from "../src/TillPolicy.sol";
import {TillVerifier} from "../src/TillVerifier.sol";
import {TillVault} from "../src/TillVault.sol";
import {TillJobEscrow} from "../src/TillJobEscrow.sol";

contract TillHandler is Test {
    TillVault public vault;
    TillAgentNFT public nft;
    uint256 public tokenA;
    uint256 public tokenB;
    address public userA;
    address public userB;

    uint256 public ghostReleasedA;
    uint256 public ghostReleasedB;

    constructor(
        TillVault vault_,
        TillAgentNFT nft_,
        uint256 tokenA_,
        uint256 tokenB_,
        address userA_,
        address userB_
    ) {
        vault = vault_;
        nft = nft_;
        tokenA = tokenA_;
        tokenB = tokenB_;
        userA = userA_;
        userB = userB_;
    }

    function ownerWithdrawA(uint96 amount) external {
        amount = uint96(bound(amount, 0, vault.available(tokenA)));
        if (amount == 0) return;
        vm.prank(userA);
        vault.withdraw(tokenA, amount);
        ghostReleasedA += amount;
    }

    function ownerWithdrawB(uint96 amount) external {
        amount = uint96(bound(amount, 0, vault.available(tokenB)));
        if (amount == 0) return;
        vm.prank(userB);
        vault.withdraw(tokenB, amount);
        ghostReleasedB += amount;
    }
}

contract TillInvariantTest is Test {
    TillAgentNFT internal nft;
    TillPolicy internal policy;
    TillVerifier internal verifier;
    TillVault internal vault;
    TillJobEscrow internal escrow;
    TillHandler internal handler;

    address internal userA = makeAddr("invA");
    address internal userB = makeAddr("invB");
    uint256 internal tokenA;
    uint256 internal tokenB;

    function setUp() public {
        nft = new TillAgentNFT();
        policy = new TillPolicy(nft);
        verifier = new TillVerifier(nft);
        vault = new TillVault(nft, policy, verifier);
        escrow = new TillJobEscrow(vault, nft);
        nft.setVault(address(vault));
        verifier.setVault(address(vault));
        vault.setEscrow(address(escrow));

        vm.deal(userA, 50 ether);
        vm.deal(userB, 50 ether);
        vm.prank(userA);
        tokenA = nft.mint();
        vm.prank(userB);
        tokenB = nft.mint();
        vm.prank(userA);
        vault.deposit{value: 20 ether}(tokenA);
        vm.prank(userB);
        vault.deposit{value: 20 ether}(tokenB);

        handler = new TillHandler(vault, nft, tokenA, tokenB, userA, userB);
        targetContract(address(handler));
    }

    function invariant_noCrossBalance() public view {
        assertEq(vault.available(tokenA) + handler.ghostReleasedA(), 20 ether);
        assertEq(vault.available(tokenB) + handler.ghostReleasedB(), 20 ether);
    }

    function invariant_vaultSolvency() public view {
        assertEq(address(vault).balance, vault.available(tokenA) + vault.available(tokenB));
    }
}
