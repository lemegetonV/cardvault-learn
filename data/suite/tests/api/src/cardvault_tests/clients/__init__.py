"""One small class per CardVault API area.

A client knows paths and request shapes, nothing else: each method sends one request and
returns the ``httpx.Response`` untouched, so a test can check a 409 as easily as a 200.
Turning a response into a model is the test's job (``checks.expect``).
"""
