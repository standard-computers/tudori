# Account View Tab Layouts

## Goal
Add independent saved column layouts to the Account view’s Transactions, Invoices, and Payments tabs.

## Changes
- Define complete column sets for all three account-detail objects, including currently displayed fields and additional values already loaded for each record.
- Add a layout button beside each tab’s export action with Show All, Hide All, Reset to Defaults, and individual column toggles.
- Apply each tab’s visibility choices to its headings, rows, grouped transaction subtotals, actions, and empty-state widths.
- Give each tab its own persistent layout so changing Transactions does not affect Invoices or Payments.
- Register all three layouts in User Settings → Layouts for centralized edit/reset controls.

## Technical details
- Reuse the existing `ColumnToggle` and `useColumnVisibility` patterns.
- Add shared definitions to the existing layout registry with distinct storage keys.
- Keep essential invoice actions always visible; all data-value columns remain user-selectable.
- Include all available object values: transaction identifiers/source values, invoice IDs/order references/notes/timestamps, and payment IDs/invoice linkage/processor/notes/timestamps.

## Verification
- Run the project type check and inspect preview build diagnostics.
- Verify each tab independently hides, shows, resets, and persists columns without misaligning rows or subtotal lines.
