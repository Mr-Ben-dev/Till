// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/interfaces/IERC721.sol";

import {TillAgentNFT} from "../src/TillAgentNFT.sol";
import {TillPolicy} from "../src/TillPolicy.sol";
import {TillVerifier} from "../src/TillVerifier.sol";
import {TillVault} from "../src/TillVault.sol";
import {TillJobEscrow} from "../src/TillJobEscrow.sol";
import {IERC7857} from "../src/vendor/erc7857/IERC7857.sol";
import {IERC7857Authorize} from "../src/vendor/erc7857/IERC7857Authorize.sol";
import {IERC7857Cloneable} from "../src/vendor/erc7857/IERC7857Cloneable.sol";
import {TransferValidityProof} from "../src/vendor/erc7857/IERC7857DataVerifier.sol";

contract TillTest is Test {
    TillAgentNFT internal nft;
    TillPolicy internal policy;
    TillVerifier internal verifier;
    TillVault internal vault;
    TillJobEscrow internal escrow;

    address internal userA = makeAddr("userA");
    address internal userB = makeAddr("userB");
    address internal execA1 = makeAddr("execA1");
    address internal execA2 = makeAddr("execA2");
    address internal execB1 = makeAddr("execB1");
    address internal payee = makeAddr("payee");
    address internal stranger = makeAddr("stranger");

    uint256 internal teePk;
    address internal teeSigner;

    uint256 internal tokenA;
    uint256 internal tokenB;

    bytes32 internal resPay = keccak256("x402-paid-result");

    function setUp() public {
        teePk = 0xA11CE;
        teeSigner = vm.addr(teePk);

        nft = new TillAgentNFT();
        policy = new TillPolicy(nft);
        verifier = new TillVerifier(nft);
        vault = new TillVault(nft, policy, verifier);
        escrow = new TillJobEscrow(vault, nft);
        nft.setVault(address(vault));
        verifier.setVault(address(vault));
        vault.setEscrow(address(escrow));

        vm.deal(userA, 100 ether);
        vm.deal(userB, 100 ether);

        vm.prank(userA);
        tokenA = nft.mint();
        vm.prank(userB);
        tokenB = nft.mint();

        _configure(userA, tokenA);
        _configure(userB, tokenB);

        vm.prank(userA);
        nft.authorizeUsage(tokenA, execA1);
        vm.prank(userA);
        nft.authorizeUsage(tokenA, execA2);
        vm.prank(userB);
        nft.authorizeUsage(tokenB, execB1);

        vm.prank(userA);
        vault.deposit{value: 10 ether}(tokenA);
        vm.prank(userB);
        vault.deposit{value: 10 ether}(tokenB);
    }

    function _configure(address owner, uint256 tokenId) internal {
        vm.startPrank(owner);
        policy.setPolicy(tokenId, 1 ether, 5 ether, 1 days, uint64(block.timestamp + 30 days), true, true);
        policy.setAllowlistMode(tokenId, true, true, false);
        policy.setAllowedTarget(tokenId, payee, true);
        policy.setAllowedResource(tokenId, resPay, true);
        verifier.setTillTeeSigner(tokenId, teeSigner, true);
        vm.stopPrank();
    }

    function _hex64(bytes32 h) internal pure returns (bytes memory out) {
        bytes memory s = bytes(Strings.toHexString(uint256(h), 32));
        out = new bytes(64);
        for (uint256 i = 0; i < 64; i++) {
            out[i] = s[i + 2];
        }
    }

    function _attestation(uint256 tokenId, uint256 nonce, address to, uint256 amount)
        internal
        view
        returns (bytes memory response, bytes memory sig)
    {
        TillVerifier.SpendIntent memory intent = TillVerifier.SpendIntent({
            tokenId: tokenId,
            nonce: nonce,
            target: to,
            amount: amount,
            resourceHash: resPay,
            allow: true
        });
        bytes32 d = verifier.digest(intent);
        bytes memory json = abi.encodePacked(
            '{"allow":true,"intent_digest":"', Strings.toHexString(uint256(d), 32), '"}'
        );
        bytes memory responseBody = json;
        bytes memory signedText = abi.encodePacked(
            "1111111111111111111111111111111111111111111111111111111111111111:",
            _hex64(sha256(responseBody))
        );
        response = abi.encode(json, responseBody, signedText);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(teePk, MessageHashUtils.toEthSignedMessageHash(signedText));
        sig = abi.encodePacked(r, s, v);
    }

    function test_supportsInterface() public view {
        assertEq(type(IERC721).interfaceId, bytes4(0x80ac58cd));
        assertEq(type(IERC7857).interfaceId, bytes4(0x2afbede9));
        assertEq(type(IERC7857Authorize).interfaceId, bytes4(0xdf597d99));
        assertEq(type(IERC7857Cloneable).interfaceId, bytes4(0x74f8628b));
        assertTrue(nft.supportsInterface(type(IERC165).interfaceId));
        assertTrue(nft.supportsInterface(type(IERC721).interfaceId));
        assertTrue(nft.supportsInterface(type(IERC7857).interfaceId));
        assertTrue(nft.supportsInterface(type(IERC7857Authorize).interfaceId));
        assertTrue(nft.supportsInterface(type(IERC7857Cloneable).interfaceId));
        assertFalse(nft.supportsInterface(0xffffffff));
        assertFalse(nft.supportsInterface(0xf9a82da5));
    }

    function test_transferFromReverts() public {
        vm.prank(userA);
        vm.expectRevert(IERC7857.ERC7857UseITransferFrom.selector);
        nft.transferFrom(userA, userB, tokenA);
    }

    function test_iTransferFromBlocked() public {
        TransferValidityProof[] memory proofs;
        vm.prank(userA);
        vm.expectRevert(TillAgentNFT.SealedKeyAttestorUnavailable.selector);
        nft.iTransferFrom(userA, userB, tokenA, proofs);
    }

    function test_iCloneFromBlocked() public {
        TransferValidityProof[] memory proofs;
        vm.prank(userA);
        vm.expectRevert(TillAgentNFT.SealedKeyAttestorUnavailable.selector);
        nft.iCloneFrom(userA, userB, tokenA, proofs);
    }

    function test_executorCannotWithdrawOrSetPolicy() public {
        vm.prank(execA1);
        vm.expectRevert(TillVault.OnlyOwner.selector);
        vault.withdraw(tokenA, 1 ether);

        vm.prank(execA1);
        vm.expectRevert(TillPolicy.NotOwner.selector);
        policy.setPaused(tokenA, true);

        vm.prank(execA1);
        vm.expectRevert(TillAgentNFT.NotTokenOwner.selector);
        nft.authorizeUsage(tokenA, stranger);
    }

    function test_releaseHappyPath() public {
        (bytes memory response, bytes memory sig) = _attestation(tokenA, 1, payee, 0.5 ether);
        uint256 beforePayee = payee.balance;
        vm.prank(execA1);
        vault.release(tokenA, payee, 0.5 ether, resPay, 1, response, sig);
        assertEq(payee.balance, beforePayee + 0.5 ether);
        assertEq(vault.available(tokenA), 9.5 ether);
    }

    function test_replayNonce() public {
        (bytes memory response, bytes memory sig) = _attestation(tokenA, 7, payee, 0.1 ether);
        vm.prank(execA1);
        vault.release(tokenA, payee, 0.1 ether, resPay, 7, response, sig);
        vm.prank(execA1);
        vm.expectRevert(TillVault.NonceUsed.selector);
        vault.release(tokenA, payee, 0.1 ether, resPay, 7, response, sig);
    }

    function test_overCapDenied() public {
        (bytes memory response, bytes memory sig) = _attestation(tokenA, 2, payee, 2 ether);
        vm.prank(execA1);
        vm.expectRevert(TillPolicy.CapExceeded.selector);
        vault.release(tokenA, payee, 2 ether, resPay, 2, response, sig);
        assertEq(vault.available(tokenA), 10 ether);
    }

    function test_wrongTargetDenied() public {
        (bytes memory response, bytes memory sig) = _attestation(tokenA, 3, stranger, 0.1 ether);
        vm.prank(execA1);
        vm.expectRevert(TillPolicy.TargetNotAllowed.selector);
        vault.release(tokenA, stranger, 0.1 ether, resPay, 3, response, sig);
    }

    function test_invalidTeeDenied() public {
        (bytes memory response,) = _attestation(tokenA, 4, payee, 0.1 ether);
        bytes memory badSig = hex"1111";
        vm.prank(execA1);
        vm.expectRevert();
        vault.release(tokenA, payee, 0.1 ether, resPay, 4, response, badSig);
        assertEq(vault.available(tokenA), 10 ether);
    }

    function test_revokeStopsExecutor() public {
        vm.prank(userA);
        nft.revokeAuthorization(tokenA, execA1);
        (bytes memory response, bytes memory sig) = _attestation(tokenA, 5, payee, 0.1 ether);
        vm.prank(execA1);
        vm.expectRevert(TillVault.OnlyExecutor.selector);
        vault.release(tokenA, payee, 0.1 ether, resPay, 5, response, sig);
    }

    function test_pauseStopsSpendOwnerCanWithdraw() public {
        vm.prank(userA);
        policy.setPaused(tokenA, true);
        (bytes memory response, bytes memory sig) = _attestation(tokenA, 6, payee, 0.1 ether);
        vm.prank(execA1);
        vm.expectRevert(TillPolicy.Paused.selector);
        vault.release(tokenA, payee, 0.1 ether, resPay, 6, response, sig);

        vm.prank(userA);
        vault.withdraw(tokenA, 1 ether);
        assertEq(userA.balance, 91 ether);
    }

    function test_expiryStopsSpend() public {
        vm.prank(userA);
        policy.setPolicy(tokenA, 1 ether, 5 ether, 1 days, uint64(block.timestamp + 10), true, true);
        vm.warp(block.timestamp + 11);
        (bytes memory response, bytes memory sig) = _attestation(tokenA, 8, payee, 0.1 ether);
        vm.prank(execA1);
        vm.expectRevert(TillPolicy.SessionExpired.selector);
        vault.release(tokenA, payee, 0.1 ether, resPay, 8, response, sig);
    }

    function test_isolationNoCrossSpend() public {
        (bytes memory response, bytes memory sig) = _attestation(tokenA, 9, payee, 0.2 ether);
        vm.prank(execB1);
        vm.expectRevert(TillVault.OnlyExecutor.selector);
        vault.release(tokenA, payee, 0.2 ether, resPay, 9, response, sig);

        (bytes memory rb, bytes memory sb) = _attestation(tokenB, 1, payee, 0.2 ether);
        vm.prank(execA1);
        vm.expectRevert(TillVault.OnlyExecutor.selector);
        vault.release(tokenB, payee, 0.2 ether, resPay, 1, rb, sb);
    }

    function test_jobSettleAndRefund() public {
        bytes32 jobOk = keccak256("job-ok");
        bytes32 jobFail = keccak256("job-fail");
        (bytes memory r1, bytes memory s1) = _attestation(tokenA, 20, payee, 0.4 ether);
        vm.prank(execA1);
        vault.lockToJob(jobOk, tokenA, payee, 0.4 ether, resPay, 20, uint64(block.timestamp + 1 days), r1, s1);

        uint256 payBefore = payee.balance;
        vm.prank(execA1);
        escrow.settle(jobOk);
        assertEq(payee.balance, payBefore + 0.4 ether);
        assertEq(vault.locked(tokenA), 0);

        (bytes memory r2, bytes memory s2) = _attestation(tokenA, 21, payee, 0.3 ether);
        uint256 availBefore = vault.available(tokenA);
        vm.prank(execA1);
        vault.lockToJob(jobFail, tokenA, payee, 0.3 ether, resPay, 21, uint64(block.timestamp + 1 days), r2, s2);
        vm.prank(userA);
        escrow.refund(jobFail);
        assertEq(vault.available(tokenA), availBefore);
        assertEq(vault.locked(tokenA), 0);
    }

    function test_refundDoesNotCreditOtherTill() public {
        bytes32 job = keccak256("job-b");
        (bytes memory r, bytes memory s) = _attestation(tokenB, 30, payee, 0.5 ether);
        uint256 aBefore = vault.available(tokenA);
        vm.prank(execB1);
        vault.lockToJob(job, tokenB, payee, 0.5 ether, resPay, 30, uint64(block.timestamp + 1), r, s);
        vm.prank(userB);
        escrow.refund(job);
        assertEq(vault.available(tokenA), aBefore);
        assertEq(vault.available(tokenB), 10 ether);
    }

    function test_concurrentIsolationA1A2B1() public {
        (bytes memory ra1, bytes memory sa1) = _attestation(tokenA, 40, payee, 0.1 ether);
        (bytes memory ra2, bytes memory sa2) = _attestation(tokenA, 41, payee, 0.1 ether);
        (bytes memory rb1, bytes memory sb1) = _attestation(tokenB, 40, payee, 0.1 ether);

        vm.prank(execA1);
        vault.release(tokenA, payee, 0.1 ether, resPay, 40, ra1, sa1);
        vm.prank(execA2);
        vault.release(tokenA, payee, 0.1 ether, resPay, 41, ra2, sa2);
        vm.prank(execB1);
        vault.release(tokenB, payee, 0.1 ether, resPay, 40, rb1, sb1);

        assertEq(vault.available(tokenA), 9.8 ether);
        assertEq(vault.available(tokenB), 9.9 ether);
    }

    function test_ownerIsExecutorWithoutAuthorize() public {
        (bytes memory response, bytes memory sig) = _attestation(tokenA, 50, payee, 0.1 ether);
        vm.prank(userA);
        vault.release(tokenA, payee, 0.1 ether, resPay, 50, response, sig);
        assertEq(vault.available(tokenA), 9.9 ether);
    }

    function test_digestMissingInJsonReverts() public {
        bytes memory json = bytes('{"allow":true,"intent_digest":"0x00"}');
        bytes memory signedText = abi.encodePacked(
            "1111111111111111111111111111111111111111111111111111111111111111:",
            _hex64(sha256(json))
        );
        bytes memory response = abi.encode(json, json, signedText);
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(teePk, MessageHashUtils.toEthSignedMessageHash(signedText));
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(execA1);
        vm.expectRevert(TillVerifier.DigestNotInResponse.selector);
        vault.release(tokenA, payee, 0.1 ether, resPay, 80, response, sig);
        assertEq(vault.available(tokenA), 10 ether);
    }

    function test_contentHashMustBindJson() public {
        TillVerifier.SpendIntent memory intent = TillVerifier.SpendIntent({
            tokenId: tokenA,
            nonce: 81,
            target: payee,
            amount: 0.1 ether,
            resourceHash: resPay,
            allow: true
        });
        bytes32 d = verifier.digest(intent);
        bytes memory json = abi.encodePacked(
            '{"allow":true,"intent_digest":"', Strings.toHexString(uint256(d), 32), '"}'
        );
        bytes memory signedText =
            bytes("1111111111111111111111111111111111111111111111111111111111111111:0000000000000000000000000000000000000000000000000000000000000000");
        bytes memory response = abi.encode(json, json, signedText);
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(teePk, MessageHashUtils.toEthSignedMessageHash(signedText));
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(execA1);
        vm.expectRevert(TillVerifier.ContentHashNotInSignedText.selector);
        vault.release(tokenA, payee, 0.1 ether, resPay, 81, response, sig);
        assertEq(vault.available(tokenA), 10 ether);
    }

    function test_allowFalseDenied() public {
        TillVerifier.SpendIntent memory intent = TillVerifier.SpendIntent({
            tokenId: tokenA,
            nonce: 82,
            target: payee,
            amount: 0.1 ether,
            resourceHash: resPay,
            allow: true
        });
        bytes32 d = verifier.digest(intent);
        bytes memory json = abi.encodePacked(
            '{"allow":false,"intent_digest":"', Strings.toHexString(uint256(d), 32), '"}'
        );
        bytes memory signedText = abi.encodePacked(
            "1111111111111111111111111111111111111111111111111111111111111111:",
            _hex64(sha256(json))
        );
        bytes memory response = abi.encode(json, json, signedText);
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(teePk, MessageHashUtils.toEthSignedMessageHash(signedText));
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(execA1);
        vm.expectRevert(TillVerifier.DecisionDenied.selector);
        vault.release(tokenA, payee, 0.1 ether, resPay, 82, response, sig);
        assertEq(vault.available(tokenA), 10 ether);
    }
}
