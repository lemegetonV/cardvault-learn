"""JSON Schemas: descriptions of what a response must look like.

A schema lists the fields a JSON object must have and the type of each one.
The jsonschema library compares a response with a schema and fails if a field
is missing or has the wrong type. The schemas follow the CardVault API docs.
"""

# One card, as the Cards service returns it. Money is in cents (whole numbers).
CARD_SCHEMA = {
    "type": "object",
    "required": [
        "card_id",
        "product",
        "last4",
        "expiry",
        "status",
        "limit",
        "available",
        "currency",
    ],
    "properties": {
        "card_id": {"type": "string"},
        "product": {"enum": ["CREDIT", "DEBIT", "PREPAID"]},
        "last4": {"type": "string", "pattern": "^[0-9]{4}$"},
        "expiry": {"type": "string", "pattern": "^[0-9]{4}-[0-9]{2}$"},
        "status": {"enum": ["ACTIVE", "LOST", "CLOSED"]},
        "limit": {"type": "integer", "minimum": 0},
        "available": {"type": "integer"},
        "currency": {"type": "string"},
    },
}

# A page of cards: a list of cards, and a cursor for the next page (or null).
CARD_PAGE_SCHEMA = {
    "type": "object",
    "required": ["items", "next_cursor"],
    "properties": {
        "items": {"type": "array", "items": CARD_SCHEMA},
        "next_cursor": {"type": ["string", "null"]},
    },
}

# Every CardVault error has this shape, whichever service sends it.
ERROR_SCHEMA = {
    "type": "object",
    "required": ["error_code", "message", "correlation_id"],
    "properties": {
        "error_code": {"type": "string", "pattern": "^[A-Z_]+$"},
        "message": {"type": "string"},
        "correlation_id": {"type": "string"},
    },
}
