# Fixture sources

All files under `fixtures/` are **synthetic public-style** records for eval only.

They mimic the *shape* of public ADS-B, NOTAM, and TLE extracts. They are **not** a live FAA, ADS-B exchange, or Space-Track dump. Do not treat identifiers, times, or coordinates as operational.

| File | Stand-in for | Retrieved |
|------|----------------|-----------|
| [adsb.json](adsb.json) | Public ADS-B samples | 2026-08-19 (authored) |
| [notams.json](notams.json) | Published NOTAM / TFR summaries | 2026-08-19 (authored) |
| [tle.json](tle.json) | Public TLE / pass-geometry summaries | 2026-08-19 (authored) |

Format conventions follow unclassified public notices (ICAO location indicators, Zulu timestamps, runway designators). No JPO, F-35, CUI, or employer content.

When a later phase adds a real public extract, cite the URL, license, and retrieval date here and keep the synthetic set as the default CI fixture.
