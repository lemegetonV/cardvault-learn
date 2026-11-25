"""What an access token says, and which tokens every service refuses (spec 5, 16.6 rule 37).

A token is three base64 parts: a header (which key signed it), claims (who and until when)
and an RS256 signature. The suite checks the claims against the spec and the signature
against the public keys auth-service publishes, exactly as each service does.
"""

from __future__ import annotations

import base64
import json
import uuid

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from cardvault_tests.auth import BearerAuth
from cardvault_tests.checks import expect, expect_error, expect_status
from cardvault_tests.clients.cards import CardsClient
from cardvault_tests.data import ALICE, customer
from cardvault_tests.models import Me
from cardvault_tests.waits import wait_until


def _jwks_key(services, kid: str):
    keys = expect_status(services.auth.get("/.well-known/jwks.json"), 200).json()["keys"]
    by_kid = {k["kid"]: k for k in keys}
    assert kid in by_kid, f"token kid {kid} is not in the JWKS ({list(by_kid)})"
    return jwt.PyJWK(by_kid[kid]).key


def test_access_token_claims_match_the_spec(alice, services, settings):
    token = alice.tokens.access_token
    header = jwt.get_unverified_header(token)
    claims = jwt.decode(
        token,
        _jwks_key(services, header["kid"]),
        algorithms=["RS256"],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
        options={"verify_exp": False},  # CardVault judges expiry by its shared clock
    )

    assert header["alg"] == "RS256"
    assert claims["sub"] == str(ALICE.customer_id)
    assert claims["exp"] - claims["iat"] == 15 * 60
    assert {"jti", "iat", "exp"} <= claims.keys()


def test_each_login_gets_a_distinct_token_id(make_customer):
    someone = make_customer(customer())
    again = someone.auth.login(someone.username, someone.password).json()["access_token"]

    first_jti = jwt.decode(someone.tokens.access_token, options={"verify_signature": False})["jti"]
    second_jti = jwt.decode(again, options={"verify_signature": False})["jti"]
    assert first_jti != second_jti


def test_customer_endpoint_needs_a_bearer_token(services):
    expect_error(services.auth.get("/v1/auth/me"), 401, "UNAUTHORIZED")


def _forge(claims: dict, kid: str) -> str:
    """A well-formed RS256 token signed by a key CardVault has never seen."""
    stranger = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return jwt.encode(claims, stranger, algorithm="RS256", headers={"kid": kid})


def _with_payload(token: str, change: dict) -> str:
    """The same token with edited claims and the original signature (now invalid)."""
    head, payload, sig = token.split(".")
    data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    data.update(change)
    new = base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")
    return f"{head}.{new}.{sig}"


def _unsigned(claims: dict) -> str:
    return jwt.encode(claims, key=None, algorithm="none")


@pytest.mark.parametrize(
    "make_bad_token",
    [
        pytest.param(lambda t, c, kid: "not-a-jwt", id="garbage"),
        pytest.param(
            lambda t, c, kid: _with_payload(t, {"sub": str(uuid.uuid4())}), id="claims-edited"
        ),
        pytest.param(lambda t, c, kid: _forge(c, kid), id="signed-by-another-key"),
        pytest.param(lambda t, c, kid: _unsigned(c), id="alg-none"),
        pytest.param(
            lambda t, c, kid: _forge({**c, "aud": "someone-else"}, "unknown-kid"), id="unknown-kid"
        ),
    ],
)
def test_tampered_or_foreign_tokens_are_refused(alice, services, make_bad_token):
    claims = jwt.decode(alice.tokens.access_token, options={"verify_signature": False})
    kid = jwt.get_unverified_header(alice.tokens.access_token)["kid"]
    bad = make_bad_token(alice.tokens.access_token, claims, kid)

    expect_error(alice.auth.me(BearerAuth(bad)), 401, "TOKEN_INVALID")


@pytest.mark.serial
def test_access_token_expires_after_15_minutes_of_shared_clock_time(
    make_customer, shared_clock, services
):
    someone = make_customer(customer({"product": "CREDIT"}))
    cards = CardsClient(services.card, someone.bearer)

    # 14 minutes 50 seconds later: still valid everywhere.
    expect_status(shared_clock.set_clock(advance_seconds=14 * 60 + 50), 200)
    expect(someone.auth.me(), 200, Me)

    # Past 15 minutes: every service refuses it, because each one checks expiry itself.
    expect_status(shared_clock.set_clock(advance_seconds=20), 200)
    expect_error(someone.auth.me(), 401, "TOKEN_EXPIRED")

    # Other services see a clock change within about a second (spec 16.7 rule 44).
    resp = wait_until(
        lambda: cards.list(),
        lambda r: r.status_code == 401,
        timeout=3,
        what="card-service to see the new time",
    )
    expect_error(resp, 401, "TOKEN_EXPIRED")
