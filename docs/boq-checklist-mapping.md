# Checklist display groups and BOQ traceability

The new numbers are presentation numbers only. Historical Checklist item IDs,
evidence slot IDs, TOR category codes and Snapshot contents remain separate.
`src/domain/boq-checklist-groups.js` contains the item-level TOR-to-BOQ map.

| Format | Display group | Equipment and software source |
| --- | --- | --- |
| SC | 01 WIM High Speed | Ranong BOQ 1.1 WIM, 1.2 station LPR, 1.3 CCTV, 1.4 processing |
| SC | 02 VMS for High Speed | Ranong BOQ 5, for installed High Speed VMS only |
| SC | 03 3D Truck Dimension Measurement | Ranong BOQ 3.1-3.4, including its own LPR Control System and LPR Camera |
| SC | 04 Low Speed WIM | Ranong BOQ 4.1 WIM, 4.2 CCTV/LPR, 4.3 processing |
| SC | 05 VMS for Low Speed | Ranong BOQ 5.3 Low Speed VMS sign and installed Low Speed VMS equipment |
| SC | 06 Central Systems | Ranong BOQ 6 control/display and 7.1 equipment cabinet |
| IMPS | 01 Image Processing | ImPS TOR 1 camera, Image Processor, management software |
| IMPS | 02 WIM | ImPS TOR 2 |
| IMPS | 03 3D Truck Dimension Measurement | Only when installed; no invented ImPS TOR number |
| IMPS | 04 LPR | ImPS TOR 3; excludes LPR Camera assigned to 3D |
| IMPS | 05 CCTV | ImPS TOR 4 |
| IMPS | 06 Data Systems | ImPS TOR 5 |

Within each installed group, `.01` contains physical equipment and `.02`
contains systems/software. The source document's construction, civil, cable,
installation, testing and calibration rows, and AVI group, are not Checklist
equipment/software rows. No Asset is created from an aggregate system heading.

## Format-qualified presentation codes

Current new-station and new-round presentation uses `boq-system-groups-v2`.
The full code is format-qualified so the same local number is never ambiguous:

| Format | Full group IDs | Example equipment | Example systems/software |
| --- | --- | --- | --- |
| SC | `SC-01` to `SC-06` | `SC-01.01` | `SC-01.02` |
| IMPS | `IMPS-01` to `IMPS-06` | `IMPS-01.01` | `IMPS-01.02` |

The `displayNumber` may be shown as `01.01` inside a format-specific screen,
but reports, accessible labels and data passed between components use the full
format-qualified code. `sourceCode` remains the original TOR/Checklist code
(for example `2.1`, `3.1`, `5.1`, or `1.1.12`) and is never replaced by the
presentation code.

Snapshots with `boq-system-groups-v1` continue to render their historical
numbers. The v2 change is presentation-only: Item IDs, Evidence Slot IDs,
TOR/source codes, Snapshot contents and WIM Parent/Lane relationships remain
unchanged.

The Ranong construction BOQ and station TOR use conflicting speed wording for
the legacy row `sc-vms-low`. Both source references are retained and the
mismatch is flagged by `sourceScopeConflict`; the presentation group follows
the explicit Station TOR scope, so this row belongs to `SC-05` Low Speed. An
installed sign is grouped by its explicit Station Profile scope, never by a
source row label or physical dimensions. A VMS without a confirmed High/Low
Speed scope is shown in a separate assignment section until the profile is
corrected.

## Detailed SC and IMPS catalog

SC and IMPS use the same canonical equipment catalog where the physical item
is shared. Format and operational scope control where an item is displayed;
they do not create a second equipment type. Installed quantities come from the
Station Profile Asset Register, not from the number of rows in this catalog.

### Shared WIM categories

| Source category | BOQ/Checklist name | System records | Physical equipment |
| --- | --- | --- | --- |
| `2.1` | `WIM SORTING SYSTEM (SENSOR)` | WIM Sorting System | WIM Sensor; WIM Loop |
| `2.2` | `WIM CONTROL SYSTEM FOR IMPS` | WIM Control System | WIM Control Computer |
| `2.3` | `WIM Electronics System for IMPS` | WIM Electronics System | WIM Electronics Cabinet; AC/DC Power Supply; WIM Network Equipment; WIM Controller; Phase Protection; Sub Breaker; Switching DC Power Supply; Transformer AC 24VAC |

WIM Sensor and WIM Loop are child Assets of an installed WIM Sorting System
instance. Each instance is tied to one WIM-enabled Lane through
`parentSystemId`; the child quantity is independent and must follow the
installed equipment.

WIM Electronics uses the hierarchy:

```text
WIM Electronics System
└── WIM Electronics Cabinet
    └── physical WIM Electronics equipment
        └── inspection points and declared outputs
```

Only Switching DC creates output-specific inspection branches, and only for
the declared outputs `12VDC`, `24VDC`, and `48VDC`. Transformer `24VAC` is a
separate item and must not be treated as `24VDC`. Outputs and inspection
readings are not separate Assets.

### System and equipment relationships

Use these operational relationships to place the Equipment and Systems &
Software branches. BOQ/TOR codes remain source references and do not decide the
parent relationship.

| Parent System | Equipment that belongs to it | Relationship and scope rule |
| --- | --- | --- |
| WIM Sorting System | WIM Sensor; WIM Loop | Each sensor/loop is bound to its installed WIM System and Lane through `parentSystemId`. |
| WIM Control System | WIM Control Computer | Keep the controller computer separate from the sensor/loop sorting branch and the cabinet electronics branch. |
| WIM Electronics System | WIM Electronics Cabinet; AC/DC Power Supply; WIM Network Equipment; WIM Controller; Phase Protection; Sub Breaker; Switching DC Power Supply; Transformer AC 24VAC | Catalog ownership is the Electronics System. Physical sub-equipment can reference its cabinet through `parentAssetId`; this relation is currently optional in station setup. |
| License Plate Recognition Control System | LPR Camera | One LPR System controls every installed LPR Camera in its explicit scope: High/Low Speed or 3D in SC; ImPS or 3D in IMPS. The former LPR Control System Equipment Asset is legacy-only. |
| 3D Truck Dimension Management System | 3D Laser Scanner; 3D Truck Dimension Controller | Keep this as the parent for dimension measurement equipment. The 3D LPR branch stays under License Plate Recognition Control System. |
| Image Processing Management System | Image Processor; Fixed CCTV Camera assigned to Image Processing | New records use `Image Processing` scope. Existing `ImPS` scope remains readable for compatibility. |
| CCTV Camera System | Fixed CCTV Camera; PTZ CCTV Camera; Network Video Recorder; Camera Joystick (SC) | A Fixed CCTV Camera used by Image Processing is placed there by its explicit scope; it must appear only in that operational branch. |
| VMS Control System | Variable Message Sign; VMS Light Sensor; VMS Display | SC High/Low Speed scopes select the corresponding VMS branch. |
| Database Management and Reporting System | Database Server | Keep this separate from Display and Data Processing. |
| Display and Data Processing System | Display and Data Processing Equipment | Equipment Cabinet remains Station Infrastructure, not a child of this System. |
| WIM High/Low Speed Data Control, Reporting, and Display/Processing Systems | No physical Asset child defined | These are independent scope-specific software/System records; they are not the WIM Control System or WIM Control Computer. |

Except for WIM Sorting System/Lane and the optional WIM Electronics cabinet
reference, the catalog expresses ownership through `systemIds` plus matching
operational scope rather than a required per-record parent foreign key. The
Checklist placement is scope-aware, but the Wizard does not yet block every
non-WIM Asset whose System record is missing or has a mismatched scope; treat
that as a follow-up validation improvement, not as evidence that the installed
equipment exists.

### SC catalog

| Display group | Equipment (`.01`) | Systems/software (`.02`) |
| --- | --- | --- |
| `SC-01` WIM High Speed | WIM Sensor; WIM Loop; WIM Control Computer; WIM Electronics Cabinet; AC/DC Power Supply; WIM Network Equipment; WIM Controller; Phase Protection; Sub Breaker; Switching DC Power Supply; Transformer AC 24VAC; High Speed LPR Camera; High Speed Fixed CCTV Camera, PTZ CCTV Camera, Camera Joystick and Network Video Recorder | WIM Sorting System; WIM Control System; WIM Electronics System; WIM High Speed Data Control System; WIM High Speed Reporting System; WIM High Speed Display and Processing System; License Plate Recognition Control System; CCTV Camera System |
| `SC-02` VMS for High Speed | VMS Sign (one presentation row, TOR quantity 3); VMS Light Sensor and VMS Display when installed | VMS Control System with High Speed scope |
| `SC-03` 3D Truck Dimension Measurement | 3D Laser Scanner; 3D Truck Dimension Controller; LPR Camera assigned to the 3D workflow | 3D Truck Dimension Management System; License Plate Recognition Control System for the 3D workflow |
| `SC-04` Low Speed WIM | PTZ CCTV Camera; Fixed CCTV Camera; LPR Camera from the Low Speed TOR rows. WIM Sensor/Loop, Control Computer, Electronics Cabinet and electronics sub-equipment appear when installed and related to their parent WIM systems | WIM Sorting System; WIM Electronics System; WIM Control System; WIM Low Speed Data Control System; WIM Low Speed Reporting System; WIM Low Speed Display and Processing System |
| `SC-05` VMS for Low Speed | VMS Sign (one presentation row, TOR quantity 1); VMS Light Sensor and VMS Display when installed | VMS Control System with Low Speed scope |
| `SC-06` Central Systems | Database Server; Display and Data Processing Equipment; Equipment Cabinet | Database Management and Reporting System; Display and Data Processing System |

SC-only catalog items are VMS Sign, VMS Light Sensor, VMS Display, and Camera
Joystick. Both `SC-02` High Speed and `SC-05` Low Speed have a VMS Sign. The
station-facing layout shows one size-free `VMS Sign` row per speed; the source
row IDs and original quantities remain available for audit. A VMS item without
an explicit High/Low Speed scope must remain unassigned until its Station
Profile scope is confirmed.

When Low Speed LPR equipment is installed, create the
`License Plate Recognition Control System` with Low Speed scope and attach the
`LPR Camera` to that system. The same System controls every LPR Camera in the
station's active LPR scopes. Apply the same installed-scope rule to the CCTV
Camera System when its PTZ, Fixed Camera, or NVR records are present.

### IMPS catalog

| Display group | Equipment (`.01`) | Systems/software (`.02`) |
| --- | --- | --- |
| `IMPS-01` Image Processing | Image Processor; Fixed CCTV Camera assigned to Image Processing | Image Processing Management System |
| `IMPS-02` WIM | WIM Sensor; WIM Loop; WIM Control Computer; WIM Electronics Cabinet; AC/DC Power Supply; WIM Network Equipment; WIM Controller; Phase Protection; Sub Breaker; Switching DC Power Supply; Transformer AC 24VAC | WIM Sorting System; WIM Control System; WIM Electronics System |
| `IMPS-03` 3D Truck Dimension Measurement | 3D Laser Scanner; 3D Truck Dimension Controller; LPR Camera assigned to 3D | 3D Truck Dimension Management System; License Plate Recognition Control System for the 3D workflow |
| `IMPS-04` LPR | LPR Camera assigned to the IMPS LPR workflow | License Plate Recognition Control System |
| `IMPS-05` CCTV | Fixed CCTV Camera; PTZ CCTV Camera; Network Video Recorder | CCTV Camera System |
| `IMPS-06` Data Systems | Database Server; Display and Data Processing Equipment; Equipment Cabinet | Database Management and Reporting System; Display and Data Processing System |

IMPS includes PTZ CCTV Camera in `IMPS-05`; add it to a Station Profile only
when installed. It is not a separate line in the current 13-row IMPS TOR
reference. IMPS does not include VMS or Camera Joystick in the current
canonical format catalog. A Fixed CCTV Camera can be placed in `IMPS-01` or
`IMPS-05` according to its explicit operational scope. An LPR Camera can be
placed in `IMPS-03` when it is the 3D input or in `IMPS-04` for the regular
IMPS LPR workflow; the same physical catalog type must not be duplicated.

When an LPR system serves the 3D workflow, create a `License Plate Recognition
Control System` System record with scope `3D` under `SC-03` or `IMPS-03`. Its
physical `LPR Camera` is a child of that LPR System. `3D Truck Dimension Management System` remains the parent of the
3D Laser Scanner and 3D Truck Dimension Controller; do not attach the LPR
equipment to both system parents.

For image processing, use the operational scope `Image Processing` for both
`Image Processing Management System`, its `Image Processor`, and a Fixed CCTV
Camera serving as its image input. The general `ImPS` scope remains available
for the regular CCTV workflow and for existing Image Processor records.

### Identity and display rules

- `2.1`, `2.2`, `2.3`, `3.1`, `3.2`, `4.1`, `4.2`, `5.1`, `5.2`, `7.1`,
  `1.1.5`, and `1.1.12` remain BOQ/TOR source categories.
- `SC-01` to `SC-06` and `IMPS-01` to `IMPS-06` are presentation groups only.
- Within a presentation group, `.01` is physical Equipment and `.02` is
  Systems & Software. `SC-01.02` must not be used as a WIM Electronics
  Equipment category.
- `รายการพิเศษ`/Custom must contain only genuinely custom catalog entries;
  standard LPR, CCTV, WIM, VMS, 3D, Database, and Cabinet items remain in
  their compatible BOQ category.
