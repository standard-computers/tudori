# Vendor View Location and History Sidebar

## Summary

Update the View Vendor window to match the View Location window’s two-column presentation: vendor information remains on the left, while a location map and change history appear in a fixed right sidebar.

## Changes

- Add address geocoding when a vendor is opened and show its location in the same OpenStreetMap panel used by the location viewer.
- Move vendor change history out of its current tab and into the right sidebar below the map.
- Keep the existing Details, Products, and Notes tabs in the main area.
- Respect the company’s vendor history setting, including the existing default-enabled behavior.
- Make the normal vendor viewer wide enough for both columns while preserving maximize/restore behavior and independent scrolling.

## Technical Details

- Reuse the location viewer’s map loading, unavailable-address, embedded-map, and external-map-link states.
- Use `AuditHistoryTab` with the existing vendor field labels and the selected vendor ID.
- Reset stale map coordinates before opening a different vendor.
- Verify the viewer layout and tab/sidebar behavior in the running app.
