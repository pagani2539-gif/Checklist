# NVR inspection baseline

Research date: 2026-10-03

This is a practical maintenance baseline, not a universal mandatory checklist. NVR models expose different health data, so checks such as SMART, RAID, temperature and fan status should only be required when the installed model reports them. New Checklist rounds combine HDD status and faulty-drive count into one row; existing Snapshot rows remain available for history.

## Routine inspection candidates

1. **Device identity and visible condition** — confirm the registered model and serial number; inspect device status indicators and unobstructed ventilation. Record fan or temperature alarms when the model exposes them.
2. **Network and recording status** — check recorder network-link status and the online/recording state of its configured camera channels. An LAN cable label does not prove connectivity.
3. **Disk and RAID health** — review each drive's reported state and RAID health, then record the number or identity of unhealthy drives in this one check. Run SMART or bad-sector diagnostics only where supported.
4. **Playback test** — select a channel and a time when footage should exist, then verify that the recording can be searched and played.
5. **Retention period** — find the oldest available recording and record how many days of footage are actually retrievable. Keep this separate from the playback test.
6. **Time and synchronization** — compare the NVR time and time zone with the station reference and confirm NTP synchronization when available.
7. **Cleaning** — clean the recorder and document the before, during and after condition according to the existing cleaning control.

Reviewing event logs is most useful when a fault or alarm is present. Exporting logs or backing up configuration is better scheduled periodically or after configuration changes than required on every routine inspection.

## Why these checks

- ONVIF Profile G describes recording control and the ability to search, retrieve and play recorded media. It defines interoperable functions, not a maintenance schedule: <https://www.onvif.org/profiles/profile-g/>
- Axis recorder documentation exposes drive and RAID state, device/drive indicators and network port indicators, including disconnected or faulty states: <https://help.axis.com/en-us/axis-s3016>
- Axis Camera Station exposes storage status, used/available capacity, per-camera recording information, retention configuration and current recording age: <https://help.axis.com/en-us/axis-camera-station-5>
- Axis OS help describes time synchronization and notes that device time is used in recordings and logs: <https://help.axis.com/en-us/axis-os-web-interface-help-lts-2026>
- Hikvision NVR documentation describes SMART and bad-sector checks for supported models: <https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000002/S000000007/S000000026/OFR000040/M000000564/User_Manual/UD33768B_Baseline_Network-Video-Recorder-I-and-M-Series_User-Manual_V4.63.010_20230609.pdf>

## Implications for the current NVR rows

- Combine “ตรวจฮาร์ดดิสก์ (HDD)” and “ตรวจจำนวนฮาร์ดดิสก์ที่ชำรุด” as one drive/RAID-health check with the count or identity of faulty drives as its result.
- Keep playback and retention as separate checks: successful playback verifies retrievability; the oldest retrievable footage measures retention.
- New v11 rounds apply the combined disk-health/count row. Playback and retention stay separate, and older policy Snapshots keep their original Checklist rows.
