# Confirm the Vehicle API `images_01` image path

Type: integration
Status: needs-info

## Evidence

A read-only search matched 12 of 12 records with no usable plate Crop/LPR path. Each record included an Overview image under `images`, which the current normalizer maps to `overviewImage`. Each also included an `images_01` path string, but the Vehicle API image endpoint returned HTTP 500 with a short JSON response for that path. The API records had no `plate.crop_path`, `lpr.path`, `lpr_path`, or `lprPath`.

See [the 12 October end-to-end report](../end-to-end-real-api-2026-10-12.md). Raw API bodies and image paths were not persisted.

## Information needed

The Vehicle API owner should confirm whether `images_01` is expected to be a valid image path and, if so, provide the supported path/endpoint or correct the upstream data. Do not add a local mapper for a path that still returns HTTP 500.
