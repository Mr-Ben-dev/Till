// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {TillAgentNFT} from "./TillAgentNFT.sol";

/// @title TillVerifier
/// @notice Fail-closed TEE binding for 0G Compute TeeML.
///         Packed `response` is abi.encode(modelJson, responseBody, signedText):
///         - modelJson MUST contain the spend digest and `"allow":true`
///         - responseBody MUST contain the digest (0G hashes this body)
///         - signedText is `sha256(req):sha256(resp)[:...]` as signed by the provider TEE
///         - sha256(responseBody) MUST equal signedText part[1] (64 hex, no 0x)
///         - teeSignature is EIP-191 personal_sign of signedText
///         Official broker: signChatWithKey hashes sha256(reqBody):sha256(respData).
contract TillVerifier {
    using ECDSA for bytes32;

    struct SpendIntent {
        uint256 tokenId;
        uint256 nonce;
        address target;
        uint256 amount;
        bytes32 resourceHash;
        bool allow;
    }

    TillAgentNFT public immutable nft;
    address public vault;
    address public immutable admin;

    mapping(address => bool) public globalTeeSigners;
    mapping(uint256 => mapping(address => bool)) public tillTeeSigners;

    uint256 public constant MAX_RESPONSE_BYTES = 16384;

    error ZeroAddress();
    error OnlyAdmin();
    error OnlyOwner();
    error OnlyVault();
    error VaultAlreadySet();
    error ResponseTooLarge();
    error PackedAttestationInvalid();
    error DigestNotInResponse();
    error ContentHashNotInSignedText();
    error UnknownTeeSigner();
    error DecisionDenied();
    error InvalidSignature();

    event VaultBound(address indexed vault);
    event GlobalTeeSignerSet(address indexed signer, bool allowed);
    event TillTeeSignerSet(uint256 indexed tokenId, address indexed signer, bool allowed);
    event AttestationAccepted(
        uint256 indexed tokenId, uint256 nonce, address indexed teeSigner, bytes32 digest
    );

    constructor(TillAgentNFT nft_) {
        nft = nft_;
        admin = msg.sender;
    }

    function setVault(address vault_) external {
        if (msg.sender != admin) revert OnlyAdmin();
        if (vault_ == address(0)) revert ZeroAddress();
        if (vault != address(0)) revert VaultAlreadySet();
        vault = vault_;
        emit VaultBound(vault_);
    }

    function setGlobalTeeSigner(address signer, bool allowed) external {
        if (msg.sender != admin) revert OnlyAdmin();
        if (signer == address(0)) revert ZeroAddress();
        globalTeeSigners[signer] = allowed;
        emit GlobalTeeSignerSet(signer, allowed);
    }

    function setTillTeeSigner(uint256 tokenId, address signer, bool allowed) external {
        if (nft.ownerOf(tokenId) != msg.sender) revert OnlyOwner();
        if (signer == address(0)) revert ZeroAddress();
        tillTeeSigners[tokenId][signer] = allowed;
        emit TillTeeSignerSet(tokenId, signer, allowed);
    }

    function digest(SpendIntent memory intent) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                intent.tokenId,
                intent.nonce,
                intent.target,
                intent.amount,
                intent.resourceHash,
                intent.allow
            )
        );
    }

    function verifyAllow(SpendIntent calldata intent, bytes calldata response, bytes calldata teeSignature)
        external
        view
        returns (address signer, bytes32 intentDigest)
    {
        if (msg.sender != vault) revert OnlyVault();
        if (!intent.allow) revert DecisionDenied();
        if (response.length == 0 || response.length > MAX_RESPONSE_BYTES) revert ResponseTooLarge();

        (bytes memory modelJson, bytes memory responseBody, bytes memory signedText) =
            abi.decode(response, (bytes, bytes, bytes));
        if (modelJson.length == 0 || responseBody.length == 0 || signedText.length == 0) {
            revert PackedAttestationInvalid();
        }

        intentDigest = digest(intent);
        bytes memory needle = bytes(Strings.toHexString(uint256(intentDigest), 32));
        if (!_contains(modelJson, needle)) revert DigestNotInResponse();
        if (!_contains(responseBody, needle)) revert DigestNotInResponse();
        if (!_allowTrue(modelJson)) revert DecisionDenied();

        bytes memory respHex = _hex64(sha256(responseBody));
        bytes memory signedRespHex = _colonPart(signedText, 1);
        if (!_eq(respHex, signedRespHex)) revert ContentHashNotInSignedText();

        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(signedText);
        signer = ECDSA.recover(ethHash, teeSignature);
        if (signer == address(0)) revert InvalidSignature();
        if (!globalTeeSigners[signer] && !tillTeeSigners[intent.tokenId][signer]) {
            revert UnknownTeeSigner();
        }
    }

    function _allowTrue(bytes memory json) internal pure returns (bool) {
        return _contains(json, bytes('"allow":true')) || _contains(json, bytes('"allow": true'));
    }

    function _hex64(bytes32 h) internal pure returns (bytes memory out) {
        bytes memory s = bytes(Strings.toHexString(uint256(h), 32));
        out = new bytes(64);
        for (uint256 i = 0; i < 64; i++) {
            out[i] = s[i + 2];
        }
    }

    function _colonPart(bytes memory text, uint256 index) internal pure returns (bytes memory part) {
        uint256 start = 0;
        uint256 seen = 0;
        for (uint256 i = 0; i <= text.length; i++) {
            bool end = i == text.length;
            if (end || text[i] == bytes1(":")) {
                if (seen == index) {
                    uint256 len = i - start;
                    part = new bytes(len);
                    for (uint256 j = 0; j < len; j++) {
                        bytes1 c = text[start + j];
                        if (c >= bytes1("A") && c <= bytes1("F")) c = bytes1(uint8(c) + 32);
                        part[j] = c;
                    }
                    return part;
                }
                seen++;
                start = i + 1;
            }
        }
        revert PackedAttestationInvalid();
    }

    function _eq(bytes memory a, bytes memory b) internal pure returns (bool) {
        if (a.length != b.length) return false;
        for (uint256 i = 0; i < a.length; i++) {
            if (a[i] != b[i]) return false;
        }
        return true;
    }

    function _contains(bytes memory haystack, bytes memory needle) internal pure returns (bool) {
        uint256 n = needle.length;
        uint256 h = haystack.length;
        if (n == 0 || n > h) return false;
        for (uint256 i = 0; i <= h - n; i++) {
            bool ok = true;
            for (uint256 j = 0; j < n; j++) {
                if (haystack[i + j] != needle[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
