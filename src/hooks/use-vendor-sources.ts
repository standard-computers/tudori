import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SearchableSelectOption } from '@/components/SearchableSelect';

interface Vendor {
  id: string;
  name: string;
  vendor_id: string;
}

interface Location {
  id: string;
  name: string;
  location_id: string;
  type: string;
}

interface UseVendorSourcesOptions {
  includeAllLocations?: boolean;
}

/**
 * Hook to fetch vendor sources that combines:
 * 1. Regular vendors from the vendors table
 * 2. DC and warehouse locations that can act as vendors (or all locations if includeAllLocations is true)
 */
export function useVendorSources(companyId: string | null, options?: UseVendorSourcesOptions) {
  const { includeAllLocations = false } = options || {};
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [dcWarehouses, setDcWarehouses] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchVendorSources = async () => {
      setLoading(true);
      
      // Build locations query - either all locations or just those marked as internal vendors
      let locationsQuery = supabase
        .from('locations')
        .select('id, name, location_id, type, is_internal_vendor')
        .eq('company_id', companyId);
      
      if (!includeAllLocations) {
        // Only include locations marked as internal vendors
        locationsQuery = locationsQuery.eq('is_internal_vendor', true);
      }
      
      // Fetch regular vendors and locations in parallel
      const [vendorsResult, locationsResult] = await Promise.all([
        supabase
          .from('vendors')
          .select('id, name, vendor_id')
          .eq('company_id', companyId)
          .order('name'),
        locationsQuery.order('name'),
      ]);

      setVendors(vendorsResult.data || []);
      setDcWarehouses(locationsResult.data || []);
      setLoading(false);
    };

    fetchVendorSources();
  }, [companyId, includeAllLocations]);

  // Combine vendors and DC/warehouse locations into searchable options
  const vendorOptions: SearchableSelectOption[] = useMemo(() => {
    const options: SearchableSelectOption[] = [];

    // Add regular vendors
    vendors.forEach((vendor) => {
      options.push({
        value: `vendor:${vendor.id}`,
        label: vendor.name,
        sublabel: vendor.vendor_id,
        group: 'Vendors',
      });
    });

    // Add DC/warehouse locations as vendor sources
    dcWarehouses.forEach((location) => {
      options.push({
        value: `location:${location.id}`,
        label: location.name,
        sublabel: `${location.location_id} • ${location.type.toUpperCase()}`,
        group: 'Internal Sources',
      });
    });

    return options;
  }, [vendors, dcWarehouses]);

  // Plain vendor list (for cases where we only want regular vendors)
  const plainVendorOptions: SearchableSelectOption[] = useMemo(() => {
    return vendors.map((vendor) => ({
      value: vendor.id,
      label: vendor.name,
      sublabel: vendor.vendor_id,
    }));
  }, [vendors]);

  // Helper to parse the combined value
  const parseVendorValue = (value: string): { type: 'vendor' | 'location'; id: string } | null => {
    if (!value) return null;
    const [type, id] = value.split(':');
    if (type === 'vendor' || type === 'location') {
      return { type, id };
    }
    // Legacy support: if no prefix, assume it's a vendor id
    return { type: 'vendor', id: value };
  };

  // Get display name for a combined value
  const getVendorDisplayName = (value: string): string => {
    if (!value) return '';
    const parsed = parseVendorValue(value);
    if (!parsed) return '';

    if (parsed.type === 'vendor') {
      const vendor = vendors.find((v) => v.id === parsed.id);
      return vendor?.name || '';
    } else {
      const location = dcWarehouses.find((l) => l.id === parsed.id);
      return location?.name || '';
    }
  };

  return {
    vendors,
    dcWarehouses,
    vendorOptions, // Combined vendors + DC/warehouse
    plainVendorOptions, // Only regular vendors
    loading,
    parseVendorValue,
    getVendorDisplayName,
  };
}
