import { describe, expect, it } from 'bun:test';
import { getRegisteredState, getRegisteredAddressPatch, applyRegisteredAddressToSap } from './sap-registered-address';

describe('SAP confirmed organization address', () => {
  const vendor = {
    vendor_type: 'domestic', state: 'Telangana',
    registered_state: 'State - Karnataka, Division - Bengaluru',
    registered_city: 'Old City', gst_jurisdiction_state: 'State - Karnataka, Division - Bengaluru',
  };

  it('prefers saved Organization State over stale GST-derived registered state', () => {
    expect(getRegisteredState(vendor)).toBe('Telangana');
    expect(getRegisteredState({ ...vendor, state: '' })).toBe('Karnataka');
  });

  it('persists only confirmed address fields and the clean organization state', () => {
    expect(getRegisteredAddressPatch(vendor, {
      reg_state: 'State - Telangana, Division - X', reg_city: 'Hyderabad', reg_addr2: '',
      pan: 'ignored', gst_jurisdiction_state: 'ignored', status: 'ignored',
    })).toEqual({ registered_state: 'Telangana', state: 'Telangana', registered_city: 'Hyderabad', registered_address_line2: '' });
    expect(vendor.registered_city).toBe('Old City');
  });

  it('retains international region codes and does not mask an empty edited state', () => {
    expect(getRegisteredState({ vendor_type: 'international', state: 'US', registered_state: 'CA' })).toBe('CA');
    expect(getRegisteredState(vendor, '')).toBe('');
    expect(() => getRegisteredAddressPatch(vendor, { reg_state: 123 })).toThrow();
  });

  it('uses the same confirmed address at the root and nested SAP vendor', () => {
    const row: Record<string, any> = { region: '10', vendors: [{ region: '10' }] };
    applyRegisteredAddressToSap(row, { ...vendor, registered_state: 'Telangana', registered_city: 'Hyderabad' }, '36');
    expect(row.region).toBe('36');
    expect(row.location).toBe('Telangana');
    expect(row.vendors[0].region).toBe('36');
    expect(row.vendors[0].city).toBe('Hyderabad');
    expect(vendor.gst_jurisdiction_state).toBe('State - Karnataka, Division - Bengaluru');
  });
});