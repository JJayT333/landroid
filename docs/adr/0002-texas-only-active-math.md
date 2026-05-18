# ADR 0002: Texas-Only Active Math

## Status

Accepted.

## Context

LANDroid can store federal/BLM, private, and other reference records, but the
current calculation model is Texas oil-and-gas title and lease review.

## Decision

Only Texas fee (`tx_fee`) and Texas state (`tx_state`) leases participate in
active Desk Map, Leasehold, payout, NPRI, ORRI, WI, and transfer-order math.

Federal/BLM and private records may be tracked in Federal Leasing and Research
as reference records, but they do not affect Texas math until the explicit Phase
2 federal/private math gate opens.

## Consequences

- Non-Texas lease data may be stored for tracking and document access.
- Active math consumers must filter to Texas math jurisdictions.
- Federal/private math fields should not be added speculatively.
- This decision protects the current Texas baseline from reference-data leakage.
