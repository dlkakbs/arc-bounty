"""
Bounty AI — Agent SDK
  1. Açık bounty'leri tarar
  2. Her bounty için 'task' çalıştırır (stub → genişletilebilir)
  3. Sonucu submit eder
  4. Challenge süresi dolduysa claimOptimistic çağırır
"""

import os
import time
import json
import logging

from dotenv import load_dotenv
from web3 import Web3

from wallet import Wallet
from bounty import BountyContract
from analyzer import decode_target, analyze_wallet, report_to_result_hash

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("agent")

# ─── Config ──────────────────────────────────────────────────────────────────

RPC_URL          = os.environ["RPC_URL"]
PRIVATE_KEY      = os.environ["PRIVATE_KEY"]
BOUNTY_REGISTRY  = os.environ["BOUNTY_REGISTRY"]
POLL_INTERVAL    = int(os.getenv("POLL_INTERVAL", "30"))   # saniye


# ─── Task runner ─────────────────────────────────────────────────────────────

def run_task(w3: Web3, bounty: dict) -> bytes | None:
    """
    taskHash convention: bytes32(uint160(targetWalletAddress))
    Son 20 byte'ı decode edip on-chain wallet analizi yapar,
    raporu JSON'a çevirip sha256 hash'ini döndürür.
    """
    target = decode_target(bounty["taskHash"])
    if target is None:
        log.warning(f"  #{bounty['id']} taskHash wallet adresi içermiyor, atlanıyor.")
        return None

    log.info(f"  Hedef wallet: {target}")
    report = analyze_wallet(w3, target)
    log.info(
        f"  Analiz tamamlandı — risk={report['risk_score']} ({report['risk_label']}), "
        f"balance={report['balance_usdc']} USDC, nonce={report['outgoing_tx_count']}"
    )

    # Raporu diske kaydet (opsiyonel — audit trail)
    out_path = f"reports/bounty_{bounty['id']}_{target[:8]}.json"
    import os; os.makedirs("reports", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)
    log.info(f"  Rapor kaydedildi: {out_path}")

    return report_to_result_hash(report)


# ─── Main loop ────────────────────────────────────────────────────────────────

def main():
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        raise ConnectionError(f"RPC bağlantısı kurulamadı: {RPC_URL}")

    wallet  = Wallet(w3, PRIVATE_KEY)
    bounties = BountyContract(w3, BOUNTY_REGISTRY)

    log.info(f"Agent adresi : {wallet.address}")
    log.info(f"Bakiye       : {wallet.balance()}")
    log.info(f"Poll interval: {POLL_INTERVAL}s")
    log.info("─" * 50)

    submitted_ids: set[int] = set()   # bu oturumda submit edilenler

    while True:
        try:
            _cycle(w3, wallet, bounties, submitted_ids)
        except KeyboardInterrupt:
            log.info("Çıkılıyor...")
            break
        except Exception as e:
            log.error(f"Döngü hatası: {e}")

        time.sleep(POLL_INTERVAL)


def _cycle(w3, wallet: Wallet, bounties: BountyContract, submitted_ids: set):
    open_list = bounties.get_open_bounties()
    now = int(time.time())

    if not open_list:
        log.info("Açık bounty yok.")
        return

    log.info(f"{len(open_list)} açık bounty bulundu.")

    for b in open_list:
        bid = b["id"]
        deadline = b["deadline"]

        # ── Deadline geçmiş → atla
        if now > deadline:
            log.info(f"  #{bid} deadline geçmiş, atlanıyor.")
            continue

        # ── Daha önce submit etmedik mi?
        already = bounties.has_submitted(bid, wallet.address)
        if not already and bid not in submitted_ids:
            log.info(f"  #{bid} [{b['validationType']}] ödül={b['reward_eth']} USDC — submit ediliyor...")
            result_hash = run_task(w3, b)
            if result_hash is None:
                continue
            tx = bounties.build_submit_tx(bid, result_hash, wallet.address)
            tx_hash = wallet.sign_and_send(tx)
            log.info(f"  Submit tx: {tx_hash}")
            wallet.wait(tx_hash)
            log.info(f"  #{bid} submit onaylandı.")
            submitted_ids.add(bid)

        # ── OPTIMISTIC: claim zamanı geldi mi?
        if b["validationType"] == "OPTIMISTIC":
            subs = bounties.get_submissions(bid)
            my_sub = next(
                (s for s in subs
                 if Web3.to_checksum_address(s["agent"]) == wallet.address),
                None,
            )
            if my_sub and not my_sub["challenged"] and not my_sub["approved"]:
                claim_at = my_sub["submittedAt"] + b["challengePeriod"]
                if now >= claim_at:
                    log.info(f"  #{bid} claim zamanı geldi, claimOptimistic çağrılıyor...")
                    tx = bounties.build_claim_tx(bid, wallet.address)
                    tx_hash = wallet.sign_and_send(tx)
                    log.info(f"  Claim tx: {tx_hash}")
                    wallet.wait(tx_hash)
                    log.info(f"  #{bid} claim onaylandı! Bakiye: {wallet.balance()}")
                else:
                    remaining = claim_at - now
                    log.info(f"  #{bid} challenge süresi: {remaining}s kaldı.")


if __name__ == "__main__":
    main()
