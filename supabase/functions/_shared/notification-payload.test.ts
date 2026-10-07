import { describe, it, expect } from 'bun:test';
import { clearSapLocation } from './sap-location';
import { vendorEmailIdentity } from './vendor-email-identity';
import { assignedApprover } from '../dashboard-approvers/routing';

describe('approved dashboard and SAP corrections', () => {
  it('clears root and all nested locations without touching address, region or classification', () => {
    const row = { location: 'Uttar Pradesh', region: '24', street: 'Line 1', str_suppl1: 'Line 2', str_suppl2: 'Line 3', str_suppl3: 'Line 4', CLASSIFY: { LOCATION_VENDOR: [{ LOCV: 'NORTH' }] }, vendors: [{ location: 'UP', region: '24' }, { location: 'Other' }] };
    clearSapLocation(row);
    expect(row.location).toBe('');
    expect(row.vendors.every(v => v.location === '')).toBe(true);
    expect(row.region).toBe('24');
    expect(row.street).toBe('Line 1');
    expect(row.str_suppl3).toBe('Line 4');
    expect(row.CLASSIFY.LOCATION_VENDOR[0].LOCV).toBe('NORTH');
  });
  it('uses application reference and name, never UUID or SAP code', () => {
    expect(vendorEmailIdentity({ reference_number: '20260728001', id: '79734f6a', sap_vendor_code: '123', trade_name: 'Trade Name' })).toEqual({ name: 'Trade Name', reference: '20260728001' });
    expect(vendorEmailIdentity({ id: '79734f6a', sap_vendor_code: '123', legal_name: 'Legal Name' }).reference).toBe('Not Assigned');
  });
  it('resolves current stage only, skips skipped/unassigned stages and ignores finished SAP', () => {
    expect(assignedApprover('buyer_review', 'buyer', undefined)).toBe('buyer');
    expect(assignedApprover('scm_head_review', 'buyer', { scm_head_user_id: 'head', skip_scm_head: false })).toBe('head');
    expect(assignedApprover('scm_head_review', 'buyer', { scm_head_user_id: 'head', skip_scm_head: true })).toBeNull();
    expect(assignedApprover('finance_2_review', 'buyer', {})).toBeNull();
    expect(assignedApprover('sap_synced', 'buyer', { scm_head_user_id: 'head' })).toBeNull();
  });
});