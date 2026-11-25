"""Verifying an email or phone with a one-time code (spec 6.4, 16.5 rules 51 and 52).

    send code   -> 202, masked destination; again within 30 s -> 429 OTP_COOLDOWN
    verify      -> right code: verified; wrong code: 422 OTP_INVALID, attempts_remaining
    5th wrong   -> 423 OTP_LOCKED for 15 minutes

Under TEST_MODE the right code is always 000000, which is a training facility: a real bank
sends a random code and a test would read it from a test inbox or SMS stub.
"""

from __future__ import annotations

import re
import uuid

import pytest

from cardvault_tests.checks import expect, expect_error, expect_status
from cardvault_tests.customers import log_in_again
from cardvault_tests.data import customer
from cardvault_tests.models import ClockView, Profile
from cardvault_tests.waits import wait_until

RIGHT_CODE = "000000"
WRONG_CODE = "123456"


@pytest.fixture
def unverified(make_customer):
    """A fresh customer whose email and phone both need verifying."""
    someone = make_customer(customer())
    email = f"{uuid.uuid4().hex[:8]}@example.test"
    expect(someone.profile.patch({"email": email, "phone": "+15550104242"}), 200, Profile)
    return someone


@pytest.mark.parametrize(
    ("channel", "masked"), [("EMAIL", r"^.\*\*\*@example\.test$"), ("PHONE", r"^\*\*\*42$")]
)
def test_sending_a_code_shows_only_a_masked_destination(unverified, channel, masked):
    resp = expect_status(unverified.profile.send_code(channel), 202)

    body = resp.json()
    assert body["channel"] == channel
    assert body["cooldown_seconds"] == 30
    assert re.match(masked, body["sent_to"]), body["sent_to"]


def test_a_second_code_within_30_seconds_is_refused(unverified):
    expect_status(unverified.profile.send_code("EMAIL"), 202)

    error = expect_error(unverified.profile.send_code("EMAIL"), 429, "OTP_COOLDOWN")

    assert 1 <= error.details["retry_after_seconds"] <= 30


def test_the_cooldown_is_per_channel(unverified):
    expect_status(unverified.profile.send_code("EMAIL"), 202)

    expect_status(unverified.profile.send_code("PHONE"), 202)


def test_a_verified_channel_needs_no_code(make_customer):
    someone = make_customer(customer())

    expect_error(someone.profile.send_code("EMAIL"), 409, "ALREADY_VERIFIED")


def test_the_right_code_verifies_the_channel(unverified):
    expect_status(unverified.profile.send_code("EMAIL"), 202)

    profile = expect(unverified.profile.verify("EMAIL", RIGHT_CODE), 200, Profile)

    assert (profile.email_verified, profile.phone_verified) == (True, False)


def test_verifying_a_verified_channel_returns_it_unchanged(make_customer):
    someone = make_customer(customer())
    before = expect(someone.profile.get(), 200, Profile)

    assert expect(someone.profile.verify("EMAIL", RIGHT_CODE), 200, Profile) == before


def test_each_wrong_code_counts_down_then_the_channel_locks(unverified):
    for remaining in (4, 3, 2, 1):
        error = expect_error(unverified.profile.verify("PHONE", WRONG_CODE), 422, "OTP_INVALID")
        assert error.details == {"attempts_remaining": remaining}

    expect_error(unverified.profile.verify("PHONE", WRONG_CODE), 423, "OTP_LOCKED")
    # Locked means locked: even the right code is refused now, and the phone stays unverified.
    expect_error(unverified.profile.verify("PHONE", RIGHT_CODE), 423, "OTP_LOCKED")
    assert expect(unverified.profile.get(), 200, Profile).phone_verified is False


def test_a_lock_on_one_channel_leaves_the_other_alone(unverified):
    for _ in range(5):
        unverified.profile.verify("PHONE", WRONG_CODE)

    assert expect(unverified.profile.verify("EMAIL", RIGHT_CODE), 200, Profile).email_verified


@pytest.mark.parametrize("code", ["12345", "1234567", "abcdef"])
def test_a_code_that_is_not_six_digits_is_a_validation_error(unverified, code):
    expect_error(unverified.profile.verify("EMAIL", code), 422, "VALIDATION_ERROR")


# ---------------------------------------------------------------- moving the clock


def advance(shared_clock, controls, seconds: float) -> None:
    """Move the shared clock and wait until profile-service has seen it (up to 1 s lag)."""
    target = expect(shared_clock.set_clock(advance_seconds=seconds), 200, ClockView).offset_seconds
    wait_until(
        lambda: expect(controls["profile"].clock(), 200, ClockView).offset_seconds,
        lambda offset: abs(offset - target) < 0.5,
        timeout=5,
        what="profile-service to see the new clock",
    )


@pytest.mark.serial
def test_a_new_code_can_be_sent_after_the_cooldown(unverified, shared_clock, controls):
    expect_status(unverified.profile.send_code("EMAIL"), 202)

    advance(shared_clock, controls, 31)

    expect_status(unverified.profile.send_code("EMAIL"), 202)


@pytest.mark.serial
def test_the_lock_ends_after_15_minutes(unverified, shared_clock, controls, services):
    for _ in range(5):
        unverified.profile.verify("PHONE", WRONG_CODE)

    advance(shared_clock, controls, 15 * 60 + 5)
    someone = log_in_again(services, unverified)  # the old access token has expired

    assert expect(someone.profile.verify("PHONE", RIGHT_CODE), 200, Profile).phone_verified
