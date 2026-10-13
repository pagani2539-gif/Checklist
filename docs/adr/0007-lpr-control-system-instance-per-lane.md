# ADR 0007: LPR Control System Instance per Installed Lane

Status: Accepted

## Context

The present LPR references describe the control system and camera quantities separately. That does not identify which lane each installed camera serves, and the equipment register can show multiple cameras under one system or a second empty system. Field operation needs an explicit one-system-per-lane relationship.

## Decision

- Store each installed LPR Control System as a separate System record with `quantity: 1` and one `laneId`. The Lane must be active, in the same Scope, and cannot already have another active LPR System.
- Apply the relationship to SC High Speed, SC Low Speed, SC 3D, IMPS ImPS, and IMPS 3D. A physical Lane can exist without WIM; adding a Lane for LPR does not create a WIM System.
- Store one real LPR Camera Asset under each LPR System through `parentSystemId`. Its Scope and Lane come from that parent. Adding a System does not create the camera Asset, and a System cannot have a second active camera.
- Block saving a new station while an active LPR System lacks a valid Lane or exactly one camera, or while an active LPR Camera lacks a valid parent or has a mismatched Scope.
- In new inspection rounds, derive section 3.1 Lane checks only from LPR System Lane IDs. Keep section 3.2 checks bound to actual camera Assets. Keep existing item IDs and closed Snapshots unchanged.
- Do not automatically reassign existing cameras. Reparenting changes their relationship while preserving the Asset ID, Asset No., serial number, and evidence. Deleting an LPR System with a camera requires the camera to be moved or removed explicitly.

## Consequences

Users add or select a Lane, add one LPR System for it, then add the actual camera Asset. Existing LPR records that lack a Lane or have zero or multiple cameras must be corrected before saving. New inspection rounds follow the recorded LPR-to-Lane relationship, while closed rounds retain the Snapshot they already captured.
