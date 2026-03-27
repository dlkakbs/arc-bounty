// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Arc Network IdentityRegistry — agents register as ERC-721 NFTs.
/// Deployed at 0x8004A818BFB912233c491871b3d84c89A494BD9e (Arc Testnet)
interface IIdentityRegistry {
    function register(string calldata metadataURI) external returns (uint256 tokenId);
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
}
