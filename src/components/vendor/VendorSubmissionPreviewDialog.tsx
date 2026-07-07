import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getSapName1, getSapVenClass } from '@/lib/sapPayloadBuilder';
import { formatPanStatus, formatAadhaarLinked } from '@/lib/panComprehensive';
import { formatIndianFy, getLastThreeCompletedIndianFyStartYears } from '@/lib/indianFy';
import {
  Building2,
  MapPin,
  Users,
  FileCheck,
  Landmark,
  TrendingUp,
  Eye,
  Shield,
  Tags,
} from 'lucide-react';
import {
  GstFilingStatusTable,
  normalizeFilingStatus,
  type FilingStatusRow,
} from '@/components/vendor/kyc/GstFilingStatusTable';


interface Props {
  vendorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SectionHeader = ({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon className="h-5 w-5 text-primary" />
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
  </div>
);

const DataRow = ({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) => (
  <div className="grid grid-cols-2 gap-2 py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground break-words">
      {value === 0 || value ? String(value) : '-'}
    </span>
  </div>
);

const maskAccount = (acc?: string | null) => {
  if (!acc) return '-';
  const s = String(acc);
  if (s.length <= 4) return s;
  return s.slice(0, -4).replace(/./g, '•') + s.slice(-4);
};

export function VendorSubmissionPreviewDialog({
  vendorId,
  open,
  onOpenChange,
}: Props) {
  const [vendor, setVendor] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [filingRows, setFilingRows] = useState<FilingStatusRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !vendorId) {
      setVendor(null);
      setFilingRows([]);
      return;
    }
    setLoading(true);
    (async () => {
      const [{ data, error }, { data: gstVal }] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', vendorId).maybeSingle(),
        supabase
          .from('vendor_validations')
          .select('details')
          .eq('vendor_id', vendorId)
          .eq('validation_type', 'gst')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (error) {
        console.error('Failed to load vendor for preview', error);
        setVendor(null);
      } else {
        setVendor(data);
      }
      setFilingRows(normalizeFilingStatus((gstVal as any)?.details?.filing_status));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, open]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Application Preview — {vendor?.legal_name || 'Vendor'}
          </DialogTitle>
          <DialogDescription>
            Read-only preview of the vendor's submitted registration form.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : vendor ? (
          <ScrollArea className="h-[65vh] pr-4 -mr-2">
            <div className="space-y-6 py-2">
              {/* Organization */}
              <div className="form-section">
                <SectionHeader icon={Building2} title="Organization Details" />
                <div className="space-y-1">
                  <DataRow label="SAP Name (NAME1)" value={getSapName1(vendor)} />
                  <DataRow label="Legal Name" value={vendor.legal_name} />
                  <DataRow label="Trade Name" value={vendor.trade_name} />
                  <DataRow label="Industry Type" value={vendor.industry_type} />
                  <DataRow label="Organization Type" value={vendor.organization_type} />
                  <DataRow label="Ownership Type" value={vendor.ownership_type} />
                  <DataRow label="Vendor Class (VEN_CLASS)" value={getSapVenClass(vendor)} />
                  <DataRow
                    label="Product Categories"
                    value={
                      Array.isArray(vendor.product_categories)
                        ? vendor.product_categories.join(', ')
                        : vendor.product_categories
                    }
                  />
                  <DataRow label="State" value={vendor.registered_state} />
                </div>
              </div>

              {/* Address */}
              <div className="form-section">
                <SectionHeader icon={MapPin} title="Address Information" />
                <div className="space-y-1">
                  <DataRow label="Address Line 1" value={vendor.registered_address} />
                  <DataRow label="Address Line 2" value={vendor.registered_address_line2} />
                  <DataRow label="Address Line 3" value={vendor.registered_address_line3} />
                  <DataRow label="Address Line 4" value={vendor.registered_address_line4} />
                  <DataRow label="City" value={vendor.registered_city} />
                  <DataRow label="State" value={vendor.registered_state} />
                  <DataRow label="PIN Code" value={vendor.registered_pincode} />
                  <DataRow label="Office Phone" value={vendor.registered_phone} />
                  <DataRow label="Fax" value={vendor.registered_fax} />
                  {vendor.communication_address && (
                    <>
                      <DataRow label="Communication Address" value={vendor.communication_address} />
                      <DataRow label="Communication City" value={vendor.communication_city} />
                      <DataRow label="Communication State" value={vendor.communication_state} />
                      <DataRow label="Communication PIN Code" value={vendor.communication_pincode} />
                    </>
                  )}
                </div>
              </div>

              {/* Contact */}
              <div className="form-section">
                <SectionHeader icon={Users} title="Contact Information" />
                <div className="space-y-1">
                  <DataRow label="Primary Contact" value={vendor.primary_contact_name} />
                  <DataRow label="Designation" value={vendor.primary_designation} />
                  <DataRow label="Primary Email" value={vendor.primary_email} />
                  <DataRow label="Primary Phone" value={vendor.primary_phone} />
                  <DataRow label="CEO/MD Name" value={vendor.ceo_name} />
                  <DataRow label="CEO/MD Email" value={vendor.ceo_email} />
                  <DataRow label="CEO/MD Phone" value={vendor.ceo_phone} />
                </div>
              </div>

              {/* Compliance & Statutory */}
              <div className="form-section">
                <SectionHeader icon={FileCheck} title="Compliance & Statutory" />
                <div className="space-y-1">
                  <DataRow label="PAN" value={vendor.pan} />
                  <DataRow label="PAN Holder Name" value={vendor.pan_holder_name} />
                  <DataRow label="PAN Status" value={formatPanStatus((vendor as any).pan_status)} />
                  <DataRow label="Is Aadhaar Linked" value={formatAadhaarLinked((vendor as any).pan_aadhaar_linked)} />
                  <DataRow label="Entity Type" value={vendor.entity_type} />
                  <DataRow
                    label="GST Registered"
                    value={vendor.gstin ? 'Yes' : 'No'}
                  />
                  {vendor.gstin && (
                    <>
                      <DataRow label="GSTIN" value={vendor.gstin} />
                      <DataRow label="GSTIN Status" value={vendor.gst_status} />
                    </>
                  )}
                  <DataRow
                    label="MSME Registered"
                    value={vendor.msme_number ? 'Yes' : 'No'}
                  />
                  {vendor.msme_number && (
                    <>
                      <DataRow label="MSME Number" value={vendor.msme_number} />
                      <DataRow label="MSME Category" value={vendor.msme_category} />
                    </>
                  )}
                  <DataRow label="Firm Registration No" value={vendor.firm_registration_no} />
                  <DataRow label="IEC No" value={vendor.iec_no} />
                </div>
              </div>

              {/* GST Filing Status */}
              {vendor.gstin && filingRows.length > 0 && (
                <div className="form-section">
                  <SectionHeader icon={Shield} title="GST Return Filing Status (Last 3 Months)" />
                  <GstFilingStatusTable rows={filingRows} limit={3} />
                </div>
              )}



              {/* Bank */}
              <div className="form-section">
                <SectionHeader icon={Landmark} title="Bank Details" />
                <div className="space-y-1">
                  <DataRow label="Bank Name" value={vendor.bank_name} />
                  <DataRow label="Account Number" value={maskAccount(vendor.account_number)} />
                  <DataRow label="IFSC Code" value={vendor.ifsc_code} />
                  <DataRow
                    label="Branch"
                    value={vendor.bank_branch_name || vendor.branch_name}
                  />
                  <DataRow label="Account Type" value={vendor.account_type} />
                  <DataRow label="Bank Address" value={vendor.bank_address} />
                </div>
              </div>

              {/* Classification Details */}
              {(() => {
                const v = vendor as any;
                const fmtArr = (arr: any) => Array.isArray(arr) && arr.length ? arr.join(', ') : '-';
                return (
                  <div className="form-section">
                    <SectionHeader icon={Tags} title="Classification Details" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-border rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-primary">Vendor_Details</p>
                        <DataRow label="Material Group for Vendors" value={fmtArr(v.material_group_vendors)} />
                        <DataRow label="Vendor Category" value={fmtArr(v.vendor_categories)} />
                      </div>
                      <div className="border border-border rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-primary">Vendor_CFSTMT</p>
                        <DataRow label="Vendor Cash Flow" value={fmtArr(v.vendor_cashflow)} />
                        <DataRow label="Tier Category" value={fmtArr(v.tier_category)} />
                      </div>
                    </div>
                  </div>
                );
              })()}


              {/* Financial */}
              {(() => {
                const [fy1, fy2, fy3] = getLastThreeCompletedIndianFyStartYears();
                const fmt = (v: any) => {
                  const n = Number(v);
                  return (v === 0 || v) && Number.isFinite(n) && n >= 0
                    ? `₹ ${n.toLocaleString('en-IN')} Lakhs`
                    : null;
                };
                const creditPeriod = Number(vendor.credit_period_expected);
                return (
                  <div className="form-section">
                    <SectionHeader icon={TrendingUp} title="Financial Information" />
                    <div className="space-y-1">
                      <DataRow label={`Turnover ${formatIndianFy(fy1)}`} value={fmt(vendor.turnover_year1)} />
                      <DataRow label={`Turnover ${formatIndianFy(fy2)}`} value={fmt(vendor.turnover_year2)} />
                      <DataRow label={`Turnover ${formatIndianFy(fy3)}`} value={fmt(vendor.turnover_year3)} />
                      <DataRow
                        label="Credit Period Expected"
                        value={
                          (vendor.credit_period_expected === 0 || vendor.credit_period_expected) &&
                          Number.isFinite(creditPeriod) &&
                          creditPeriod >= 0
                            ? `${vendor.credit_period_expected} days`
                            : null
                        }
                      />
                      <DataRow label="Major Customer 1" value={vendor.major_customer_1} />
                      <DataRow label="Major Customer 2" value={vendor.major_customer_2} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Vendor not found.
          </div>
        )}

        <DialogFooter className="gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
