"""BountyRegistry kontratıyla etkileşim katmanı."""

import json
from pathlib import Path
from web3 import Web3

ABI_PATH = Path(__file__).parent / "abi.json"

BOUNTY_STATUS = {0: "OPEN", 1: "COMPLETED", 2: "CANCELLED"}
VALIDATION_TYPE = {0: "EXPLICIT", 1: "OPTIMISTIC"}


class BountyContract:
    def __init__(self, w3: Web3, address: str):
        abi = json.loads(ABI_PATH.read_text())
        self.contract = w3.eth.contract(
            address=Web3.to_checksum_address(address),
            abi=abi,
        )
        self.w3 = w3

    # ─── Read ───────────────────────────────────────────────────────────────

    def bounty_count(self) -> int:
        return self.contract.functions.bountyCount().call()

    def get_bounty(self, bounty_id: int) -> dict:
        b = self.contract.functions.bounties(bounty_id).call()
        return {
            "id":              bounty_id,
            "creator":         b[0],
            "taskHash":        b[1].hex(),
            "reward":          b[2],
            "reward_eth":      self.w3.from_wei(b[2], "ether"),
            "deadline":        b[3],
            "challengePeriod": b[4],
            "validationType":  VALIDATION_TYPE.get(b[5], b[5]),
            "validator":       b[6],
            "status":          BOUNTY_STATUS.get(b[7], b[7]),
            "winner":          b[8],
        }

    def get_open_bounties(self) -> list[dict]:
        count = self.bounty_count()
        open_bounties = []
        for i in range(1, count + 1):
            b = self.get_bounty(i)
            if b["status"] == "OPEN":
                open_bounties.append(b)
        return open_bounties

    def get_submissions(self, bounty_id: int) -> list[dict]:
        subs = self.contract.functions.getSubmissions(bounty_id).call()
        return [
            {
                "agent":       s[0],
                "resultHash":  s[1].hex(),
                "submittedAt": s[2],
                "challenged":  s[3],
                "approved":    s[4],
                "rejected":    s[5],
            }
            for s in subs
        ]

    def agent_stats(self, address: str) -> dict:
        s = self.contract.functions.agentStats(
            Web3.to_checksum_address(address)
        ).call()
        return {
            "completed":   s[0],
            "attempted":   s[1],
            "totalEarned": self.w3.from_wei(s[2], "ether"),
        }

    def has_submitted(self, bounty_id: int, agent_address: str) -> bool:
        subs = self.get_submissions(bounty_id)
        addr = Web3.to_checksum_address(agent_address)
        return any(Web3.to_checksum_address(s["agent"]) == addr for s in subs)

    # ─── Write ──────────────────────────────────────────────────────────────

    def build_submit_tx(self, bounty_id: int, result_hash: bytes, sender: str) -> dict:
        return self.contract.functions.submitResult(
            bounty_id, result_hash
        ).build_transaction({
            "from":  Web3.to_checksum_address(sender),
            "nonce": self.w3.eth.get_transaction_count(Web3.to_checksum_address(sender)),
        })

    def build_claim_tx(self, bounty_id: int, sender: str) -> dict:
        return self.contract.functions.claimOptimistic(
            bounty_id
        ).build_transaction({
            "from":  Web3.to_checksum_address(sender),
            "nonce": self.w3.eth.get_transaction_count(Web3.to_checksum_address(sender)),
        })
