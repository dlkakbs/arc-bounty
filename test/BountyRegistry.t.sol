// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/BountyRegistry.sol";
import "../src/interfaces/IIdentityRegistry.sol";
import "../src/interfaces/IReputationRegistry.sol";

// ── Mock Contracts ──────────────────────────────────────────────────────────

contract MockIdentityRegistry is IIdentityRegistry {
    mapping(address => uint256) private _balance;

    function register(address agent) external {
        _balance[agent] = 1;
    }

    function register(string calldata) external returns (uint256) {
        _balance[msg.sender] = 1;
        return 1;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balance[owner];
    }

    function ownerOf(uint256) external pure returns (address) {
        return address(0);
    }
}

contract MockReputationRegistry is IReputationRegistry {
    event FeedbackGiven(address agent, bool positive);

    function giveFeedback(address agent, bool positive) external {
        emit FeedbackGiven(agent, positive);
    }
}

// ── Test Contract ───────────────────────────────────────────────────────────

contract BountyRegistryTest is Test {
    BountyRegistry      public registry;
    MockIdentityRegistry   public idRegistry;
    MockReputationRegistry public repRegistry;

    address institution = makeAddr("institution");
    address agent1      = makeAddr("agent1");
    address agent2      = makeAddr("agent2");
    address validator   = makeAddr("validator");

    uint256 constant REWARD   = 100e18; // 100 USDC (18 decimals)
    bytes32 constant TASK     = keccak256("Analyze Q1 2026 market data");
    bytes32 constant RESULT_1 = keccak256("agent1 result");
    bytes32 constant RESULT_2 = keccak256("agent2 result");

    function setUp() public {
        idRegistry  = new MockIdentityRegistry();
        repRegistry = new MockReputationRegistry();
        registry    = new BountyRegistry(address(idRegistry), address(repRegistry));

        // Ajanları kaydet
        idRegistry.register(agent1);
        idRegistry.register(agent2);

        // Bakiye ver
        vm.deal(institution, 1000e18);
        vm.deal(agent1, 10e18);
        vm.deal(agent2, 10e18);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    function _createExplicit() internal returns (uint256) {
        vm.prank(institution);
        return registry.createBounty{value: REWARD}(
            "Test Task",
            "Test task description",
            TASK,
            block.timestamp + 7 days,
            BountyRegistry.ValidationType.EXPLICIT,
            validator,
            0
        );
    }

    function _createOptimistic(uint256 period) internal returns (uint256) {
        vm.prank(institution);
        return registry.createBounty{value: REWARD}(
            "Test Task",
            "Test task description",
            TASK,
            block.timestamp + 7 days,
            BountyRegistry.ValidationType.OPTIMISTIC,
            validator, // arbitrator rolünde
            period
        );
    }

    // ── createBounty ─────────────────────────────────────────────────────────

    function test_createBounty_explicit() public {
        uint256 id = _createExplicit();
        (
            address creator,
            ,
            ,
            bytes32 taskHash,
            uint256 reward,
            ,
            ,
            BountyRegistry.ValidationType vType,
            ,
            BountyRegistry.BountyStatus status,
        ) = registry.bounties(id);

        assertEq(creator, institution);
        assertEq(taskHash, TASK);
        assertEq(reward, REWARD);
        assertEq(uint8(vType), uint8(BountyRegistry.ValidationType.EXPLICIT));
        assertEq(uint8(status), uint8(BountyRegistry.BountyStatus.OPEN));
    }

    function test_createBounty_zeroReward_reverts() public {
        vm.prank(institution);
        vm.expectRevert(BountyRegistry.ZeroReward.selector);
        registry.createBounty{value: 0}("T", "D", TASK, block.timestamp + 1 days, BountyRegistry.ValidationType.EXPLICIT, validator, 0);
    }

    function test_createBounty_pastDeadline_reverts() public {
        vm.prank(institution);
        vm.expectRevert(BountyRegistry.InvalidDeadline.selector);
        registry.createBounty{value: REWARD}("T", "D", TASK, block.timestamp - 1, BountyRegistry.ValidationType.EXPLICIT, validator, 0);
    }

    // ── cancelBounty ─────────────────────────────────────────────────────────

    function test_cancelBounty_refunds() public {
        uint256 id = _createExplicit();
        uint256 before = institution.balance;

        vm.prank(institution);
        registry.cancelBounty(id);

        assertEq(institution.balance, before + REWARD);
        (, , , , , , , , , BountyRegistry.BountyStatus status,) = registry.bounties(id);
        assertEq(uint8(status), uint8(BountyRegistry.BountyStatus.CANCELLED));
    }

    function test_cancelBounty_notCreator_reverts() public {
        uint256 id = _createExplicit();
        vm.prank(agent1);
        vm.expectRevert(BountyRegistry.NotCreator.selector);
        registry.cancelBounty(id);
    }

    function test_cancelBounty_withSubmission_reverts() public {
        uint256 id = _createExplicit();

        vm.prank(agent1);
        registry.submitResult(id, RESULT_1, "result 1");

        vm.prank(institution);
        vm.expectRevert(BountyRegistry.BountyHasSubmissions.selector);
        registry.cancelBounty(id);
    }

    // ── submitResult ─────────────────────────────────────────────────────────

    function test_submitResult_success() public {
        uint256 id = _createExplicit();

        vm.prank(agent1);
        registry.submitResult(id, RESULT_1, "result 1");

        BountyRegistry.Submission[] memory subs = registry.getSubmissions(id);
        assertEq(subs.length, 1);
        assertEq(subs[0].agent, agent1);
        assertEq(subs[0].resultHash, RESULT_1);
        assertEq(_agentStats(agent1).attempted, 1);
    }

    function test_submitResult_notRegistered_reverts() public {
        uint256 id = _createExplicit();
        address stranger = makeAddr("stranger");

        vm.prank(stranger);
        vm.expectRevert(BountyRegistry.NotRegisteredAgent.selector);
        registry.submitResult(id, RESULT_1, "result 1");
    }

    function test_submitResult_duplicate_reverts() public {
        uint256 id = _createExplicit();

        vm.prank(agent1);
        registry.submitResult(id, RESULT_1, "result 1");

        vm.prank(agent1);
        vm.expectRevert(BountyRegistry.AlreadySubmitted.selector);
        registry.submitResult(id, RESULT_1, "result 1");
    }

    function test_submitResult_afterDeadline_reverts() public {
        uint256 id = _createExplicit();

        vm.warp(block.timestamp + 8 days);

        vm.prank(agent1);
        vm.expectRevert(BountyRegistry.DeadlinePassed.selector);
        registry.submitResult(id, RESULT_1, "result 1");
    }

    // ── EXPLICIT: approveResult ───────────────────────────────────────────────

    function test_explicit_approveResult_pays_winner() public {
        uint256 id = _createExplicit();

        vm.prank(agent1);
        registry.submitResult(id, RESULT_1, "result 1");

        uint256 before = agent1.balance;

        vm.prank(validator);
        registry.approveResult(id, agent1);

        assertEq(agent1.balance, before + REWARD);

        AgentStats memory stats = _agentStats(agent1);
        assertEq(stats.completed,   1);
        assertEq(stats.attempted,   1);
        assertEq(stats.totalEarned, REWARD);
        assertEq(registry.successRate(agent1), 10_000);
    }

    function test_explicit_notValidator_reverts() public {
        uint256 id = _createExplicit();

        vm.prank(agent1);
        registry.submitResult(id, RESULT_1, "result 1");

        vm.prank(agent2);
        vm.expectRevert(BountyRegistry.NotValidator.selector);
        registry.approveResult(id, agent1);
    }

    function test_explicit_rejectResult_bountyStaysOpen() public {
        uint256 id = _createExplicit();

        vm.prank(agent1);
        registry.submitResult(id, RESULT_1, "result 1");

        vm.prank(validator);
        registry.rejectResult(id, agent1);

        // Bounty hâlâ OPEN — agent2 hâlâ kazanabilir
        vm.prank(agent2);
        registry.submitResult(id, RESULT_2, "result 2");

        uint256 before = agent2.balance;
        vm.prank(validator);
        registry.approveResult(id, agent2);

        assertEq(agent2.balance, before + REWARD);
    }

    // ── OPTIMISTIC: claimOptimistic ───────────────────────────────────────────

    function test_optimistic_claim_afterPeriod() public {
        uint256 period = 1 hours;
        uint256 id = _createOptimistic(period);

        vm.prank(agent1);
        registry.submitResult(id, RESULT_1, "result 1");

        // Challenge süresi dolmadan önce claim revert eder
        vm.prank(agent1);
        vm.expectRevert(BountyRegistry.ChallengePeriodActive.selector);
        registry.claimOptimistic(id);

        // Challenge süresi dolduktan sonra claim çalışır
        vm.warp(block.timestamp + period + 1);

        uint256 before = agent1.balance;
        vm.prank(agent1);
        registry.claimOptimistic(id);

        assertEq(agent1.balance, before + REWARD);
    }

    function test_optimistic_challengeResult() public {
        uint256 period = 48 hours;
        uint256 id = _createOptimistic(0); // default period

        vm.prank(agent1);
        registry.submitResult(id, RESULT_1, "result 1");

        // agent2 itiraz eder
        vm.prank(agent2);
        registry.challengeResult(id, agent1);

        // Artık claim yapamaz
        vm.warp(block.timestamp + period + 1);
        vm.prank(agent1);
        vm.expectRevert(BountyRegistry.AlreadyChallenged.selector);
        registry.claimOptimistic(id);
    }

    function test_optimistic_resolveDispute_winner() public {
        uint256 id = _createOptimistic(0);

        vm.prank(agent1);
        registry.submitResult(id, RESULT_1, "result 1");

        vm.prank(agent2);
        registry.challengeResult(id, agent1);

        uint256 before = agent1.balance;

        // Arbitrator agent1'i kazanan seçer
        vm.prank(validator);
        registry.resolveDispute(id, agent1);

        assertEq(agent1.balance, before + REWARD);
        assertEq(_agentStats(agent1).completed, 1);
    }

    function test_optimistic_resolveDispute_nobody_refunds_creator() public {
        uint256 id = _createOptimistic(0);

        vm.prank(agent1);
        registry.submitResult(id, RESULT_1, "result 1");

        vm.prank(agent2);
        registry.challengeResult(id, agent1);

        uint256 before = institution.balance;

        // Arbitrator kimseyi kazanan seçmez → creator'a iade
        vm.prank(validator);
        registry.resolveDispute(id, address(0));

        assertEq(institution.balance, before + REWARD);
    }

    // ── Leaderboard / successRate ─────────────────────────────────────────────

    function test_successRate() public {
        // agent1: 2 attempt, 1 win → %50
        uint256 id1 = _createExplicit();
        vm.prank(agent1); registry.submitResult(id1, RESULT_1, "result 1");
        vm.prank(validator); registry.approveResult(id1, agent1);

        vm.prank(institution);
        uint256 id2 = registry.createBounty{value: REWARD}(
            "Task 2", "Task 2 description",
            keccak256("task2"), block.timestamp + 1 days,
            BountyRegistry.ValidationType.EXPLICIT, validator, 0
        );
        vm.prank(agent1); registry.submitResult(id2, RESULT_1, "result 1");
        vm.prank(validator); registry.rejectResult(id2, agent1);

        assertEq(registry.successRate(agent1), 5_000); // 50%
    }

    function test_multipleAgents_compete() public {
        uint256 id = _createExplicit();

        vm.prank(agent1); registry.submitResult(id, RESULT_1, "result 1");
        vm.prank(agent2); registry.submitResult(id, RESULT_2, "result 2");

        assertEq(registry.getSubmissions(id).length, 2);

        vm.prank(validator);
        registry.approveResult(id, agent2);

        assertEq(_agentStats(agent2).completed, 1);
        assertEq(_agentStats(agent1).completed, 0);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    struct AgentStats {
        uint256 completed;
        uint256 attempted;
        uint256 totalEarned;
    }

    function _agentStats(address agent) internal view returns (AgentStats memory) {
        (uint256 c, uint256 a, uint256 e) = registry.agentStats(agent);
        return AgentStats(c, a, e);
    }
}
