// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TillTest} from "./Till.t.sol";
import {TillVault} from "../src/TillVault.sol";

contract ReentrantPayee {
    TillVault public vault;
    uint256 public tokenId;
    bytes32 public resource;
    bool public attacking;

    constructor(TillVault vault_, uint256 tokenId_, bytes32 resource_) {
        vault = vault_;
        tokenId = tokenId_;
        resource = resource_;
    }

    receive() external payable {
        if (attacking) {
            attacking = false;
            // Attempt to re-enter release; must revert via nonReentrant.
            vault.release(tokenId, address(this), 0.01 ether, resource, 99, "", "");
        }
    }

    function arm() external {
        attacking = true;
    }
}

contract TillReentrancyTest is TillTest {
    function test_reentrancyOnReleaseReverts() public {
        ReentrantPayee attacker = new ReentrantPayee(vault, tokenA, resPay);
        vm.prank(userA);
        policy.setAllowedTarget(tokenA, address(attacker), true);

        (bytes memory response, bytes memory sig) = _attestation(tokenA, 70, address(attacker), 0.1 ether);
        attacker.arm();
        vm.prank(execA1);
        vm.expectRevert();
        vault.release(tokenA, address(attacker), 0.1 ether, resPay, 70, response, sig);
        assertEq(vault.available(tokenA), 10 ether);
    }
}
