// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Arc Network ReputationRegistry — on-chain agent feedback.
/// Deployed at 0x8004B663056A597Dffe9eCcC1965A193B7388713 (Arc Testnet)
interface IReputationRegistry {
    function giveFeedback(address agent, bool positive) external;
}
