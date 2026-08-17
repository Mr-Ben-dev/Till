// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {TillAgentNFT} from "../src/TillAgentNFT.sol";
import {TillPolicy} from "../src/TillPolicy.sol";
import {TillVerifier} from "../src/TillVerifier.sol";
import {TillVault} from "../src/TillVault.sol";
import {TillJobEscrow} from "../src/TillJobEscrow.sol";

contract DeployTill is Script {
    function run() external {
        vm.createDir("deployments", true);
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        TillAgentNFT nft = new TillAgentNFT();
        TillPolicy policy = new TillPolicy(nft);
        TillVerifier verifier = new TillVerifier(nft);
        TillVault vault = new TillVault(nft, policy, verifier);
        TillJobEscrow escrow = new TillJobEscrow(vault, nft);

        nft.setVault(address(vault));
        verifier.setVault(address(vault));
        vault.setEscrow(address(escrow));

        vm.stopBroadcast();

        vm.writeFile(
            string.concat("deployments/", vm.toString(block.chainid), ".json"),
            string.concat(
                '{\n',
                '  "chainId": ',
                vm.toString(block.chainid),
                ',\n',
                '  "TillAgentNFT": "',
                vm.toString(address(nft)),
                '",\n',
                '  "TillPolicy": "',
                vm.toString(address(policy)),
                '",\n',
                '  "TillVerifier": "',
                vm.toString(address(verifier)),
                '",\n',
                '  "TillVault": "',
                vm.toString(address(vault)),
                '",\n',
                '  "TillJobEscrow": "',
                vm.toString(address(escrow)),
                '"\n',
                "}\n"
            )
        );
    }
}
