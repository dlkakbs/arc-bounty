// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {BountyRegistry} from "../src/BountyRegistry.sol";

/// @notice Wallet analizi bounty'si oluşturur.
///
/// taskHash convention: bytes32(uint160(targetWallet))
/// → Agent bu hash'ten hedef adresi decode eder,
///   on-chain analiz yapar, risk raporu üretir.
///
/// Kullanım:
///   forge script script/CreateWalletAnalysisBounty.s.sol \
///     --rpc-url $RPC_URL --broadcast \
///     --env TARGET_WALLET=0x...   (analiz edilecek adres)
///     --env REWARD_USDC=2         (ödül miktarı, integer)
contract CreateWalletAnalysisBountyScript is Script {
    address constant BOUNTY_REGISTRY = 0xAB9177A08d5359057b603d62ee2181Ef825802c5;

    function run() external {
        uint256 deployerKey   = vm.envUint("PRIVATE_KEY");
        address deployer      = vm.addr(deployerKey);
        address targetWallet  = vm.envAddress("TARGET_WALLET");
        uint256 rewardUsdc    = vm.envOr("REWARD_USDC", uint256(1));

        // Convention: taskHash = bytes32(uint160(targetWallet))
        bytes32 taskHash = bytes32(uint256(uint160(targetWallet)));

        vm.startBroadcast(deployerKey);

        BountyRegistry registry = BountyRegistry(payable(BOUNTY_REGISTRY));

        uint256 bountyId = registry.createBounty{value: rewardUsdc * 1e18}(
            taskHash,
            block.timestamp + 7 days,
            BountyRegistry.ValidationType.OPTIMISTIC,
            deployer,   // arbitrator
            1 hours     // challenge period
        );

        vm.stopBroadcast();

        console.log("=== Wallet Analysis Bounty Created ===");
        console.log("Bounty ID    :", bountyId);
        console.log("Target wallet:", targetWallet);
        console.log("Reward       :", rewardUsdc, "USDC");
        console.log("Deadline     : 7 days");
        console.log("taskHash     :");
        console.logBytes32(taskHash);
    }
}
