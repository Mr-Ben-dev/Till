// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/interfaces/IERC721.sol";
import {IERC7857} from "../src/vendor/erc7857/IERC7857.sol";
import {IERC7857Authorize} from "../src/vendor/erc7857/IERC7857Authorize.sol";
import {IERC7857Cloneable} from "../src/vendor/erc7857/IERC7857Cloneable.sol";
import {IERC7857Metadata} from "../src/vendor/erc7857/IERC7857Metadata.sol";

contract PrintInterfaceIds is Script {
    function run() external pure {
        console2.log("IERC165");
        console2.logBytes4(type(IERC165).interfaceId);
        console2.log("IERC721");
        console2.logBytes4(type(IERC721).interfaceId);
        console2.log("IERC7857");
        console2.logBytes4(type(IERC7857).interfaceId);
        console2.log("IERC7857Authorize");
        console2.logBytes4(type(IERC7857Authorize).interfaceId);
        console2.log("IERC7857Cloneable");
        console2.logBytes4(type(IERC7857Cloneable).interfaceId);
        console2.log("IERC7857Metadata");
        console2.logBytes4(type(IERC7857Metadata).interfaceId);
    }
}
