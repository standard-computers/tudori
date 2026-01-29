
# Add Production Control to Bins

This plan adds a "Production" control to bins, matching the recently added area-level production control. When enabling production on a bin, the system will validate that the parent area also has production enabled.

---

## Summary

- Add a new database column `is_production_enabled` to the `bins` table
- Add a Production toggle to the Bin dialog's Controls tab
- Implement validation that prevents enabling production on a bin if its parent area doesn't allow production
- Show a clear error message when the validation fails

---

## Implementation Steps

### 1. Database Migration

Create a migration to add the `is_production_enabled` column to the bins table, defaulting to `false`.

**File: New migration file**
```sql
ALTER TABLE public.bins
ADD COLUMN is_production_enabled BOOLEAN NOT NULL DEFAULT false;
```

---

### 2. Update BinDialog Interface and State

Update the Bin interface and form state to include the new production control.

**File: `src/components/cockpit/BinDialog.tsx`**

Add to the `Bin` interface:
```typescript
interface Bin {
  // ... existing fields
  is_production_enabled?: boolean;
}
```

Add to the `formData` state initialization:
```typescript
is_production_enabled: false,
```

Update the edit mode to read the existing value and the copy function to include it.

---

### 3. Pass Area Data to BinDialog

Update the BinDialog props to receive the areas list with their production status, so we can validate against the parent area.

**File: `src/components/cockpit/BinDialog.tsx`**

Update the `Area` interface to include:
```typescript
interface Area {
  id: string;
  area_id: string;
  name: string;
  is_production_enabled?: boolean;
}
```

---

### 4. Add Production Control UI with Validation

Add a new "Production" section to the Controls tab with validation logic.

**File: `src/components/cockpit/BinDialog.tsx`**

Add below the existing Picking controls:
```typescript
<div className="border-t pt-4 space-y-4">
  <h4 className="font-medium text-sm">Production</h4>
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="is_production_enabled">Allow Production</Label>
        <p className="text-xs text-muted-foreground">
          Enable production operations in this bin
        </p>
      </div>
      <Switch
        id="is_production_enabled"
        checked={formData.is_production_enabled}
        onCheckedChange={(checked) => {
          // Validate parent area allows production
          const parentArea = areas.find(a => a.id === formData.area_id);
          if (checked && !parentArea?.is_production_enabled) {
            toast.error('Cannot enable production: parent area does not allow production');
            return;
          }
          setFormData({ ...formData, is_production_enabled: checked });
        }}
      />
    </div>
  </div>
</div>
```

---

### 5. Update Submit Handler

Include the new field when saving the bin.

**File: `src/components/cockpit/BinDialog.tsx`**

Add to `binData` object in `handleSubmit`:
```typescript
is_production_enabled: formData.is_production_enabled,
```

---

### 6. Update Cockpit.tsx Interface

Ensure the Bin interface in Cockpit.tsx includes the new field.

**File: `src/pages/Cockpit.tsx`**

Add to the Bin interface:
```typescript
is_production_enabled?: boolean;
```

---

## Technical Details

### Validation Flow

```text
User toggles "Allow Production" ON
         |
         v
Check parent area's is_production_enabled
         |
    +----+----+
    |         |
   YES        NO
    |         |
    v         v
 Enable    Show error toast:
production "Cannot enable production:
           parent area does not allow
           production"
```

### Data Flow

- The `areas` prop already passed to BinDialog contains all area data
- The Area interface will be extended to include `is_production_enabled`
- No changes needed to how BinDialog is called from Cockpit.tsx since areas already include the production flag from the database

### Edge Cases

1. **Area production disabled after bin was enabled**: The system allows this state to exist, but the validation prevents new bins from being enabled when area is disabled
2. **Changing bin's area**: When area is changed (only on create, as editing doesn't allow area change), the production state is preserved but validation still applies on save
