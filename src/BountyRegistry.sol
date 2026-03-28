// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IIdentityRegistry.sol";
import "./interfaces/IReputationRegistry.sol";

/// @title  BountyRegistry
/// @notice Agent Bounty Protocol on Arc Network.
///
///  Flow (EXPLICIT):
///    Institution → createBounty(EXPLICIT, validator) + USDC (native)
///    Agent       → submitResult(bountyId, resultHash)
///    Validator   → approveResult / rejectResult
///    Contract    → winner'a USDC transfer
///
///  Flow (OPTIMISTIC):
///    Institution → createBounty(OPTIMISTIC, arbitrator) + USDC (native)
///    Agent       → submitResult(bountyId, resultHash)
///    Anyone      → challengeResult (challenge süresi içinde)
///    Agent       → claimOptimistic (challenge süresi dolduysa, itiraz yoksa)
///    Arbitrator  → resolveDispute (itiraz varsa)
///
/// Arc'ta native token USDC (18 decimals). msg.value = USDC.
contract BountyRegistry {
    // ─────────────────────────────────────────────────────────────── Types ──

    enum ValidationType { EXPLICIT, OPTIMISTIC }
    enum BountyStatus   { OPEN, COMPLETED, CANCELLED }

    struct Bounty {
        address        creator;
        string         title;            // human-readable task title
        string         description;      // full task description
        bytes32        taskHash;         // keccak256(task description) veya IPFS CID
        uint256        reward;           // native USDC
        uint256        deadline;         // submission deadline
        uint256        challengePeriod;  // sadece OPTIMISTIC için (saniye)
        ValidationType validationType;
        address        validator;        // EXPLICIT: validator | OPTIMISTIC: arbitrator
        BountyStatus   status;
        address        winner;
    }

    struct Submission {
        address agent;
        bytes32 resultHash;
        uint256 submittedAt;
        bool    challenged;
        bool    approved;
        bool    rejected;
    }

    struct AgentStats {
        uint256 completed;    // kazanılan bounty sayısı
        uint256 attempted;    // toplam submit sayısı
        uint256 totalEarned;  // toplam kazanç (native USDC)
    }

    // ───────────────────────────────────────────────────────────── Storage ──

    uint256 public bountyCount;

    mapping(uint256 => Bounty)                      public bounties;
    mapping(uint256 => Submission[])                public submissions;
    /// bountyId → agent → (submission array index + 1), 0 = yok
    mapping(uint256 => mapping(address => uint256)) private _submissionIndex;
    mapping(address => AgentStats)                  public agentStats;

    IIdentityRegistry   public immutable identityRegistry;
    IReputationRegistry public immutable reputationRegistry;

    uint256 public constant DEFAULT_CHALLENGE_PERIOD = 48 hours;

    // ─────────────────────────────────────────────────────────────── Events ──

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 reward,
        ValidationType  validationType,
        string title,
        string description
    );
    event ResultSubmitted(uint256 indexed bountyId, address indexed agent, bytes32 resultHash, string result);
    event ResultApproved(uint256 indexed bountyId, address indexed agent);
    event ResultRejected(uint256 indexed bountyId, address indexed agent);
    event ResultChallenged(uint256 indexed bountyId, address indexed agent, address indexed challenger);
    event DisputeResolved(uint256 indexed bountyId, address indexed winner);
    event RewardClaimed(uint256 indexed bountyId, address indexed winner, uint256 amount);
    event BountyCancelled(uint256 indexed bountyId);

    // ─────────────────────────────────────────────────────────────── Errors ──

    error NotRegisteredAgent();
    error BountyNotOpen();
    error DeadlinePassed();
    error ChallengePeriodActive();
    error ChallengePeriodExpired();
    error AlreadySubmitted();
    error AlreadyChallenged();
    error NotValidator();
    error SubmissionNotFound();
    error WrongValidationType();
    error NotCreator();
    error BountyHasSubmissions();
    error ZeroReward();
    error InvalidDeadline();

    // ────────────────────────────────────────────────────────── Constructor ──

    constructor(address _identityRegistry, address _reputationRegistry) {
        identityRegistry   = IIdentityRegistry(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
    }

    // ──────────────────────────────────────────────── Institution Functions ──

    /// @notice Yeni bounty oluştur. msg.value = USDC ödül miktarı.
    /// @param title          görev başlığı (okunabilir)
    /// @param description    görev açıklaması (tam metin)
    /// @param taskHash       keccak256(görev açıklaması) veya IPFS CID bytes32
    /// @param deadline       submission son tarihi (unix timestamp)
    /// @param validationType EXPLICIT veya OPTIMISTIC
    /// @param validator      EXPLICIT'te onaylayan; OPTIMISTIC'te dispute arbitratoru
    /// @param challengePeriod OPTIMISTIC için itiraz süresi (0 → DEFAULT_CHALLENGE_PERIOD)
    function createBounty(
        string calldata title,
        string calldata description,
        bytes32        taskHash,
        uint256        deadline,
        ValidationType validationType,
        address        validator,
        uint256        challengePeriod
    ) external payable returns (uint256 bountyId) {
        if (msg.value == 0) revert ZeroReward();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        bountyId = ++bountyCount;

        uint256 period = 0;
        if (validationType == ValidationType.OPTIMISTIC) {
            period = challengePeriod == 0 ? DEFAULT_CHALLENGE_PERIOD : challengePeriod;
        }

        bounties[bountyId] = Bounty({
            creator:         msg.sender,
            title:           title,
            description:     description,
            taskHash:        taskHash,
            reward:          msg.value,
            deadline:        deadline,
            challengePeriod: period,
            validationType:  validationType,
            validator:       validator,
            status:          BountyStatus.OPEN,
            winner:          address(0)
        });

        emit BountyCreated(bountyId, msg.sender, msg.value, validationType, title, description);
    }

    /// @notice Henüz submit edilmemiş bounty'yi iptal et, USDC'yi geri al.
    function cancelBounty(uint256 bountyId) external {
        Bounty storage b = bounties[bountyId];
        if (msg.sender != b.creator) revert NotCreator();
        if (b.status != BountyStatus.OPEN) revert BountyNotOpen();
        if (submissions[bountyId].length > 0) revert BountyHasSubmissions();

        b.status = BountyStatus.CANCELLED;
        uint256 refund = b.reward;
        b.reward = 0;

        (bool ok,) = b.creator.call{value: refund}("");
        require(ok, "refund failed");

        emit BountyCancelled(bountyId);
    }

    // ────────────────────────────────────────────────────────── Agent Functions ──

    /// @notice Arc IdentityRegistry'de kayıtlı agent submit eder.
    /// @param resultHash keccak256(sonuç) — integrity kontrolü için
    /// @param result     sonuç metni — event log'unda kalıcı olarak saklanır
    function submitResult(uint256 bountyId, bytes32 resultHash, string calldata result) external {
        if (identityRegistry.balanceOf(msg.sender) == 0) revert NotRegisteredAgent();

        Bounty storage b = bounties[bountyId];
        if (b.status != BountyStatus.OPEN) revert BountyNotOpen();
        if (block.timestamp > b.deadline) revert DeadlinePassed();
        if (_submissionIndex[bountyId][msg.sender] != 0) revert AlreadySubmitted();

        submissions[bountyId].push(Submission({
            agent:       msg.sender,
            resultHash:  resultHash,
            submittedAt: block.timestamp,
            challenged:  false,
            approved:    false,
            rejected:    false
        }));

        _submissionIndex[bountyId][msg.sender] = submissions[bountyId].length; // 1-indexed

        agentStats[msg.sender].attempted++;

        emit ResultSubmitted(bountyId, msg.sender, resultHash, result);
    }

    // ──────────────────────────────────────────── EXPLICIT Validation ──

    /// @notice Validator belirlediği agent'ı onaylar → USDC otomatik gönderilir.
    function approveResult(uint256 bountyId, address agent) external {
        Bounty storage b = bounties[bountyId];
        if (msg.sender != b.validator) revert NotValidator();
        if (b.status != BountyStatus.OPEN) revert BountyNotOpen();
        if (b.validationType != ValidationType.EXPLICIT) revert WrongValidationType();

        Submission storage sub = _getSubmission(bountyId, agent);
        sub.approved = true;

        emit ResultApproved(bountyId, agent);
        _settleWinner(bountyId, agent);
    }

    /// @notice Validator bir submission'ı reddeder (diğer agent'lar hâlâ yarışır).
    function rejectResult(uint256 bountyId, address agent) external {
        Bounty storage b = bounties[bountyId];
        if (msg.sender != b.validator) revert NotValidator();
        if (b.status != BountyStatus.OPEN) revert BountyNotOpen();
        if (b.validationType != ValidationType.EXPLICIT) revert WrongValidationType();

        Submission storage sub = _getSubmission(bountyId, agent);
        sub.rejected = true;

        emit ResultRejected(bountyId, agent);
    }

    // ─────────────────────────────────────────── OPTIMISTIC Validation ──

    /// @notice Challenge süresi dolmuşsa ve itiraz yoksa, agent ödülü çeker.
    function claimOptimistic(uint256 bountyId) external {
        Bounty storage b = bounties[bountyId];
        if (b.status != BountyStatus.OPEN) revert BountyNotOpen();
        if (b.validationType != ValidationType.OPTIMISTIC) revert WrongValidationType();

        Submission storage sub = _getSubmission(bountyId, msg.sender);
        if (sub.challenged) revert AlreadyChallenged();
        if (block.timestamp < sub.submittedAt + b.challengePeriod) revert ChallengePeriodActive();

        sub.approved = true;

        emit ResultApproved(bountyId, msg.sender);
        _settleWinner(bountyId, msg.sender);
    }

    /// @notice Challenge süresi içinde herhangi biri bir submission'a itiraz eder.
    function challengeResult(uint256 bountyId, address agent) external {
        Bounty storage b = bounties[bountyId];
        if (b.status != BountyStatus.OPEN) revert BountyNotOpen();
        if (b.validationType != ValidationType.OPTIMISTIC) revert WrongValidationType();

        Submission storage sub = _getSubmission(bountyId, agent);
        if (sub.challenged) revert AlreadyChallenged();
        if (block.timestamp >= sub.submittedAt + b.challengePeriod) revert ChallengePeriodExpired();

        sub.challenged = true;

        emit ResultChallenged(bountyId, agent, msg.sender);
    }

    /// @notice Dispute durumunda arbitrator kazananı belirler.
    /// @param winner address(0) → tüm taraflar haksız, USDC creator'a iade edilir.
    function resolveDispute(uint256 bountyId, address winner) external {
        Bounty storage b = bounties[bountyId];
        if (msg.sender != b.validator) revert NotValidator();
        if (b.status != BountyStatus.OPEN) revert BountyNotOpen();
        if (b.validationType != ValidationType.OPTIMISTIC) revert WrongValidationType();

        emit DisputeResolved(bountyId, winner);

        if (winner == address(0)) {
            b.status = BountyStatus.CANCELLED;
            uint256 refund = b.reward;
            b.reward = 0;
            (bool ok,) = b.creator.call{value: refund}("");
            require(ok, "refund failed");
            emit BountyCancelled(bountyId);
        } else {
            _getSubmission(bountyId, winner); // winner'ın submission'ı olmalı
            _settleWinner(bountyId, winner);
        }
    }

    // ──────────────────────────────────────────────────────────── Internal ──

    function _getSubmission(uint256 bountyId, address agent)
        internal
        view
        returns (Submission storage)
    {
        uint256 idx = _submissionIndex[bountyId][agent];
        if (idx == 0) revert SubmissionNotFound();
        return submissions[bountyId][idx - 1];
    }

    function _settleWinner(uint256 bountyId, address winner) internal {
        Bounty storage b = bounties[bountyId];
        b.status = BountyStatus.COMPLETED;
        b.winner = winner;

        AgentStats storage stats = agentStats[winner];
        stats.completed++;
        stats.totalEarned += b.reward;

        // Arc ReputationRegistry'ye pozitif feedback yaz
        try reputationRegistry.giveFeedback(winner, true) {} catch {}

        uint256 payout = b.reward;
        b.reward = 0;

        (bool ok,) = winner.call{value: payout}("");
        require(ok, "payout failed");

        emit RewardClaimed(bountyId, winner, payout);
    }

    // ───────────────────────────────────────────────────────────── Views ──

    function getSubmissions(uint256 bountyId) external view returns (Submission[] memory) {
        return submissions[bountyId];
    }

    /// @return Basis points cinsinden başarı oranı (10000 = %100)
    function successRate(address agent) external view returns (uint256) {
        AgentStats memory s = agentStats[agent];
        if (s.attempted == 0) return 0;
        return (s.completed * 10_000) / s.attempted;
    }
}
