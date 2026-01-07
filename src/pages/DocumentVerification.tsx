import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileCheck, 
  FileX, 
  Eye, 
  Play, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  Download
} from 'lucide-react';

type ValidationStatus = 'pending' | 'passed' | 'failed' | 'skipped';

interface VendorDocument {
  id: string;
  vendor_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_at: string;
}

interface Vendor {
  id: string;
  legal_name: string | null;
  gstin: string | null;
  pan: string | null;
  status: string;
  submitted_at: string | null;
  primary_email: string | null;
}

interface Validation {
  id: string;
  vendor_id: string;
  validation_type: string;
  status: ValidationStatus;
  message: string | null;
  validated_at: string;
}

const validationTypeLabels: Record<string, string> = {
  gst: 'GST Verification',
  pan: 'PAN Verification',
  bank: 'Bank Account Verification',
  msme: 'MSME Verification',
  name_match: 'Name Match Verification',
};

const statusConfig: Record<ValidationStatus, { icon: React.ReactNode; color: string; label: string }> = {
  passed: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success', label: 'Passed' },
  failed: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive', label: 'Failed' },
  pending: { icon: <Clock className="h-4 w-4" />, color: 'text-warning', label: 'Pending' },
  skipped: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-muted-foreground', label: 'Skipped' },
};

export default function DocumentVerification() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [runningValidation, setRunningValidation] = useState<string | null>(null);

  // Fetch vendors pending validation
  const { data: vendors, isLoading: isLoadingVendors } = useQuery({
    queryKey: ['vendors-for-verification'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .in('status', ['validation_pending', 'validation_failed', 'finance_review'])
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data as Vendor[];
    },
  });

  // Fetch documents for selected vendor
  const { data: documents } = useQuery({
    queryKey: ['vendor-documents', selectedVendor?.id],
    queryFn: async () => {
      if (!selectedVendor) return [];
      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', selectedVendor.id);
      
      if (error) throw error;
      return data as VendorDocument[];
    },
    enabled: !!selectedVendor,
  });

  // Fetch validations for selected vendor
  const { data: validations, refetch: refetchValidations } = useQuery({
    queryKey: ['vendor-validations', selectedVendor?.id],
    queryFn: async () => {
      if (!selectedVendor) return [];
      const { data, error } = await supabase
        .from('vendor_validations')
        .select('*')
        .eq('vendor_id', selectedVendor.id)
        .order('validated_at', { ascending: false });
      
      if (error) throw error;
      return data as Validation[];
    },
    enabled: !!selectedVendor,
  });

  // Run single validation
  const runValidationMutation = useMutation({
    mutationFn: async ({ vendorId, validationType }: { vendorId: string; validationType: string }) => {
      setRunningValidation(validationType);
      
      const { data: vendor } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();
      
      if (!vendor) throw new Error('Vendor not found');

      let response;
      switch (validationType) {
        case 'gst':
          response = await supabase.functions.invoke('validate-gst', {
            body: { gstin: vendor.gstin, legalName: vendor.legal_name },
          });
          break;
        case 'pan':
          response = await supabase.functions.invoke('validate-pan', {
            body: { pan: vendor.pan, name: vendor.legal_name },
          });
          break;
        case 'bank':
          response = await supabase.functions.invoke('validate-bank', {
            body: { 
              accountNumber: vendor.account_number, 
              ifscCode: vendor.ifsc_code,
              accountHolderName: vendor.legal_name,
            },
          });
          break;
        case 'name_match':
          response = await supabase.functions.invoke('validate-name-match', {
            body: { 
              vendorName: vendor.legal_name,
              gstLegalName: vendor.legal_name,
              threshold: 80,
            },
          });
          break;
        case 'msme':
          response = await supabase.functions.invoke('validate-msme', {
            body: { msmeNumber: vendor.msme_number },
          });
          break;
        default:
          throw new Error('Unknown validation type');
      }

      // Delete existing validation of this type
      await supabase
        .from('vendor_validations')
        .delete()
        .eq('vendor_id', vendorId)
        .eq('validation_type', validationType);

      // Save new validation result
      const { error } = await supabase.from('vendor_validations').insert({
        vendor_id: vendorId,
        validation_type: validationType,
        status: response.data?.valid ? 'passed' : 'failed',
        message: response.data?.message || `${validationType} validation completed`,
        details: response.data,
      });

      if (error) throw error;
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Validation Complete',
        description: 'Validation has been run successfully.',
      });
      refetchValidations();
      queryClient.invalidateQueries({ queryKey: ['vendors-for-verification'] });
    },
    onError: (error) => {
      toast({
        title: 'Validation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setRunningValidation(null);
    },
  });

  // Run all validations
  const runAllValidationsMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      const validationTypes = ['gst', 'pan', 'bank', 'name_match', 'msme'];
      
      for (const type of validationTypes) {
        await runValidationMutation.mutateAsync({ vendorId, validationType: type });
      }
    },
    onSuccess: () => {
      toast({
        title: 'All Validations Complete',
        description: 'All validations have been run successfully.',
      });
    },
  });

  // Get latest validation for each type
  const getLatestValidation = (type: string): Validation | undefined => {
    return validations?.find(v => v.validation_type === type);
  };

  const downloadDocument = async (doc: VendorDocument) => {
    const { data, error } = await supabase.storage
      .from('vendor-documents')
      .download(doc.file_path);
    
    if (error) {
      toast({
        title: 'Download Failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Document Verification</h1>
        <p className="text-muted-foreground">
          Review and verify vendor documents and run validation checks
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Vendors List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Vendors Pending Verification
            </CardTitle>
            <CardDescription>
              Select a vendor to view their documents and validations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingVendors ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : vendors?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No vendors pending verification</p>
            ) : (
              <div className="space-y-2">
                {vendors?.map((vendor) => (
                  <div
                    key={vendor.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedVendor?.id === vendor.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedVendor(vendor)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{vendor.legal_name || 'Unknown Vendor'}</p>
                        <p className="text-sm text-muted-foreground">{vendor.primary_email}</p>
                      </div>
                      <Badge variant={
                        vendor.status === 'validation_failed' ? 'destructive' :
                        vendor.status === 'finance_review' ? 'default' : 'secondary'
                      }>
                        {vendor.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      GST: {vendor.gstin || 'N/A'} | PAN: {vendor.pan || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Validation Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Validation Status
            </CardTitle>
            <CardDescription>
              {selectedVendor ? `Validations for ${selectedVendor.legal_name}` : 'Select a vendor to view validations'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedVendor ? (
              <p className="text-center py-8 text-muted-foreground">Select a vendor from the list</p>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={() => runAllValidationsMutation.mutate(selectedVendor.id)}
                    disabled={runAllValidationsMutation.isPending}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run All Validations
                  </Button>
                </div>

                <div className="space-y-2">
                  {['gst', 'pan', 'bank', 'name_match', 'msme'].map((type) => {
                    const validation = getLatestValidation(type);
                    const status = validation?.status || 'pending';
                    const config = statusConfig[status];

                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <span className={config.color}>{config.icon}</span>
                          <div>
                            <p className="font-medium text-sm">{validationTypeLabels[type]}</p>
                            <p className="text-xs text-muted-foreground">
                              {validation?.message || 'Not yet validated'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={status === 'passed' ? 'default' : status === 'failed' ? 'destructive' : 'secondary'}>
                            {config.label}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runValidationMutation.mutate({ 
                              vendorId: selectedVendor.id, 
                              validationType: type 
                            })}
                            disabled={runningValidation === type}
                          >
                            {runningValidation === type ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents Section */}
      {selectedVendor && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>
              Documents submitted by {selectedVendor.legal_name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No documents uploaded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Type</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents?.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium capitalize">
                        {doc.document_type.replace('_', ' ')}
                      </TableCell>
                      <TableCell>{doc.file_name}</TableCell>
                      <TableCell>
                        {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadDocument(doc)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
