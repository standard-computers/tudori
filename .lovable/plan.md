

# Validate Production-Enabled Bins for BoM Steps

This plan adds validation to the Bill of Materials step creation to ensure that only bins with production enabled can be used for BoM steps.

---

## Summary

- Update the bins query to include the `is_production_enabled` field
- Filter bin options to only show production-enabled bins when selecting for a step
- Add validation in `handleAddStep` to prevent adding steps with non-production bins
- Show a clear message when no production-enabled bins exist for a location

---

## Implementation Steps

### 1. Update Bin Interface

Add the `is_production_enabled` field to the Bin interface.

**File: `src/pages/BillOfMaterials.tsx`**

```typescript
interface Bin {
  id: string;
  bin_id: string;
  name: string;
  area_id: string;
  is_production_enabled?: boolean;
  area?: { location_id: string };
}
```

---

### 2. Update fetchAllBins Query

Include the `is_production_enabled` field in the bin query.

**File: `src/pages/BillOfMaterials.tsx`**

```typescript
const fetchAllBins = async () => {
  const { data, error } = await supabase
    .from('bins')
    .select(`
      id,
      bin_id,
      name,
      area_id,
      is_production_enabled,
      area:areas(location_id)
    `)
    .order('bin_id');

  if (!error && data) {
    setAllBins(data as unknown as Bin[]);
  }
};
```

---

### 3. Filter Bins to Production-Enabled Only

Update the `getFilteredBins` function to only return bins that have production enabled.

**File: `src/pages/BillOfMaterials.tsx`**

```typescript
// Get bins for selected location in step form (production-enabled only)
const getFilteredBins = (locationId: string) => {
  if (!locationId) return [];
  return allBins.filter(bin => 
    bin.area?.location_id === locationId && 
    bin.is_production_enabled === true
  );
};
```

---

### 4. Add Validation in handleAddStep

Add a validation check to ensure the selected bin has production enabled before adding the step.

**File: `src/pages/BillOfMaterials.tsx`**

```typescript
const handleAddStep = () => {
  if (!newStep.name.trim()) {
    toast.error('Please enter a step name');
    return;
  }

  // Validate bin has production enabled if selected
  if (newStep.bin_id) {
    const selectedBin = allBins.find(b => b.id === newStep.bin_id);
    if (selectedBin && !selectedBin.is_production_enabled) {
      toast.error('Selected bin does not have production enabled');
      return;
    }
  }

  // ... rest of existing logic
};
```

---

### 5. Update Bin Selector Placeholder

Update the placeholder text to indicate that only production-enabled bins are shown.

**File: `src/pages/BillOfMaterials.tsx`**

In the Steps tab bin selector:
```typescript
<SearchableSelect
  options={binOptions}
  value={newStep.bin_id}
  onValueChange={(value) => setNewStep(prev => ({ ...prev, bin_id: value }))}
  placeholder={
    newStep.location_id 
      ? (binOptions.length > 0 ? "Select production bin" : "No production bins available")
      : "Select location first"
  }
  disabled={!newStep.location_id}
/>
```

---

## Technical Details

### Validation Flow

```text
User selects Location
        |
        v
System filters bins to:
  - Bins in that location (via area)
  - AND is_production_enabled = true
        |
        v
  +-----+-----+
  |           |
 Found      None
  |           |
  v           v
Show bins   Show "No production
in dropdown   bins available"
```

### Data Flow

- The `fetchAllBins` function now retrieves the `is_production_enabled` field
- The `getFilteredBins` function filters to only production-enabled bins
- The bin dropdown only shows valid options, preventing invalid selections
- A secondary validation in `handleAddStep` provides defense-in-depth

### Edge Cases

1. **Location has no production-enabled bins**: The dropdown will be empty with a helpful placeholder message
2. **Bin selected before field was added**: The validation uses `=== true` to safely handle undefined/null values
3. **Existing BoM steps with non-production bins**: These are preserved but new steps cannot use non-production bins

