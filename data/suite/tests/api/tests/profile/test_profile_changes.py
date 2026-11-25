"""Changing contact details (spec 6.4, 16.5 rule 35).

A changed email or phone must be verified again, because the bank has not proved the
customer owns the new one. Setting the same value again changes nothing. ``If-Match``
(the version from the last read) stops a customer overwriting a change they have not seen.
"""

from __future__ import annotations

import uuid

import pytest

from cardvault_tests.checks import expect, expect_error
from cardvault_tests.data import customer
from cardvault_tests.models import Profile


def new_email() -> str:
    return f"{uuid.uuid4().hex[:8]}@example.test"


def test_the_profile_shows_the_version_as_its_etag(make_customer):
    someone = make_customer(customer())

    resp = someone.profile.get()

    profile = expect(resp, 200, Profile)
    assert resp.headers["ETag"] == f'"{profile.version}"'


def test_a_new_email_is_unverified_and_the_version_goes_up(make_customer):
    someone = make_customer(customer())
    before = expect(someone.profile.get(), 200, Profile)
    email = new_email()

    after = expect(someone.profile.patch({"email": email}), 200, Profile)

    assert (after.email, after.email_verified) == (email, False)
    assert (after.phone, after.phone_verified) == (before.phone, True), "phone is untouched"
    assert after.version == before.version + 1


def test_the_same_email_again_keeps_it_verified(make_customer):
    someone = make_customer(customer())
    before = expect(someone.profile.get(), 200, Profile)

    after = expect(someone.profile.patch({"email": before.email}), 200, Profile)

    assert after == before


def test_a_new_phone_is_unverified(make_customer):
    someone = make_customer(customer())

    after = expect(someone.profile.patch({"phone": "+15550109999"}), 200, Profile)

    assert (after.phone, after.phone_verified, after.email_verified) == (
        "+15550109999",
        False,
        True,
    )


def test_the_current_version_in_if_match_is_accepted(make_customer):
    someone = make_customer(customer())
    version = expect(someone.profile.get(), 200, Profile).version

    expect(someone.profile.patch({"email": new_email()}, if_match=f'"{version}"'), 200, Profile)


def test_an_old_version_in_if_match_is_refused_and_nothing_changes(make_customer):
    someone = make_customer(customer())
    seen = expect(someone.profile.get(), 200, Profile)
    newer = expect(someone.profile.patch({"email": new_email()}), 200, Profile)

    resp = someone.profile.patch({"email": new_email()}, if_match=seen.version)

    error = expect_error(resp, 412, "VERSION_MISMATCH")
    assert error.details == {"current_version": newer.version}
    assert expect(someone.profile.get(), 200, Profile) == newer


def test_an_if_match_that_is_not_a_version_is_a_bad_request(make_customer):
    someone = make_customer(customer())

    expect_error(
        someone.profile.patch({"email": new_email()}, if_match="abc"), 400, "INVALID_IF_MATCH"
    )


@pytest.mark.parametrize(
    "change",
    [{"email": "not-an-email"}, {"phone": "0123 456"}, {"phone": "+1" + "5" * 15}],
    ids=["email", "phone-no-plus", "phone-over-15-digits"],
)
def test_invalid_contact_details_are_refused(make_customer, change):
    someone = make_customer(customer())
    before = expect(someone.profile.get(), 200, Profile)

    expect_error(someone.profile.patch(change), 422, "VALIDATION_ERROR")

    assert expect(someone.profile.get(), 200, Profile) == before
