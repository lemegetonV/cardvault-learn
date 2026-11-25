"""What we know in advance about the demo customers.

The demo data is loaded the same way every time CardVault is set up, so these
values are the expected results for tests that only read alice's data.
Tests must never change alice: they create their own customer instead.
"""

ALICE = {
    "username": "alice",
    "display_name": "Alice Archer",
    # Her four cards, by the last four digits of the card number.
    "cards": {
        "4417": "CREDIT",
        "2045": "DEBIT",
        "7380": "CREDIT",
        "5521": "PREPAID",
    },
    # Cards that are in her wallet.
    "wallet_cards": ["4417", "2045"],
    # Cards that may not join the wallet, and the reason the app gives.
    "ineligible_cards": {
        "7380": "NOT_RECENTLY_USED",
        "5521": "PRODUCT_NOT_SUPPORTED",
    },
}

# In test environments the one-time verification code is always this value.
TEST_VERIFICATION_CODE = "000000"

# The reasons a customer can choose when disputing a purchase.
DISPUTE_REASONS = ["UNRECOGNISED", "DUPLICATE", "WRONG_AMOUNT", "NOT_RECEIVED"]
