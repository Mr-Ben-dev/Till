// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TillTest} from "./Till.t.sol";
import {TillPolicy} from "../src/TillPolicy.sol";

contract TillFuzzTest is TillTest {
    function testFuzz_releaseWithinCap(uint96 amount, uint256 nonce) public {
        amount = uint96(bound(amount, 1, 1 ether));
        nonce = bound(nonce, 1000, type(uint128).max);
        (bytes memory response, bytes memory sig) = _attestation(tokenA, nonce, payee, amount);
        uint256 before = vault.available(tokenA);
        vm.prank(execA1);
        vault.release(tokenA, payee, amount, resPay, nonce, response, sig);
        assertEq(vault.available(tokenA), before - amount);
        assertEq(vault.available(tokenB), 10 ether);
    }

    function testFuzz_overCapNeverMoves(uint96 amount, uint256 nonce) public {
        amount = uint96(bound(amount, 1 ether + 1, 5 ether));
        nonce = bound(nonce, 2000, type(uint128).max);
        (bytes memory response, bytes memory sig) = _attestation(tokenA, nonce, payee, amount);
        vm.prank(execA1);
        vm.expectRevert(TillPolicy.CapExceeded.selector);
        vault.release(tokenA, payee, amount, resPay, nonce, response, sig);
        assertEq(vault.available(tokenA), 10 ether);
        assertEq(vault.available(tokenB), 10 ether);
    }

    function testFuzz_userBCannotSpendA(uint256 nonce) public {
        nonce = bound(nonce, 3000, type(uint128).max);
        (bytes memory response, bytes memory sig) = _attestation(tokenA, nonce, payee, 0.05 ether);
        vm.prank(execB1);
        vm.expectRevert();
        vault.release(tokenA, payee, 0.05 ether, resPay, nonce, response, sig);
        assertEq(vault.available(tokenA), 10 ether);
    }
}
