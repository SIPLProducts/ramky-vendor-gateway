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
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileCheck, 
  Play, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  Download,
  IndianRupee,
  Loader2,
  Eye,
  Mail,
  FileText,
  FileImage,
  File,
  ExternalLink,
  ListChecks,
  Send
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

type ValidationStatus = 'pending' | 'passed' | 'failed' | 'skipped';

interface VendorDocument {
  id: string;
  vendor_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type?: string | null;
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
  account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  msme_number: string | null;
}

interface Validation {
  id: string;
  vendor_id: string;
  validation_type: string;
  status: ValidationStatus;
  message: string | null;
  validated_at: string;
  details: any;
}

interface Deviation {
  type: string;
  label: string;
  status: 'failed' | 'pending';
  message: string;
}

interface PennyDropResult {
  success: boolean;
  verified: boolean;
  message: string;
  data?: {
    transactionId: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    branchName: string;
    accountHolderName: string;
    nameMatchScore: number;
    nameMatchStatus: 'exact' | 'partial' | 'mismatch';
    accountStatus: string;
    accountType: string;
    transferAmount: number;
    transferStatus: string;
    transferTimestamp: string;
    utrNumber: string;
    responseTime: number;
  };
  stages?: {
    stage: string;
    status: 'completed' | 'in_progress' | 'pending' | 'failed';
    message: string;
    timestamp: string;
  }[];
}

const validationTypeLabels: Record<string, string> = {
  gst: 'GST Verification',
  pan: 'PAN Verification',
  bank: 'Bank Account Verification',
  msme: 'MSME Verification',
  name_match: 'Name Match Verification',
  penny_drop: 'Penny Drop Verification',
};

const documentTypeLabels: Record<string, string> = {
  gst_certificate: 'GST Certificate',
  pan_card: 'PAN Card',
  msme_certificate: 'MSME Certificate',
  cancelled_cheque: 'Cancelled Cheque',
  financial_docs: 'Financial Documents',
  incorporation_certificate: 'Incorporation Certificate',
  other: 'Other Document',
};

const statusConfig: Record<ValidationStatus, { icon: React.ReactNode; color: string; label: string }> = {
  passed: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-600', label: 'Passed' },
  failed: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive', label: 'Failed' },
  pending: { icon: <Clock className="h-4 w-4" />, color: 'text-yellow-600', label: 'Pending' },
  skipped: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-muted-foreground', label: 'Skipped' },
};

function getFileIcon(mimeType: string | null | undefined) {
  if (!mimeType) return <File className="h-5 w-5" />;
  if (mimeType.startsWith('image/')) return <FileImage className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

export default function DocumentVerification() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [runningValidation, setRunningValidation] = useState<string | null>(null);
  const [pennyDropResult, setPennyDropResult] = useState<PennyDropResult | null>(null);
  const [pennyDropStage, setPennyDropStage] = useState(0);
  const [showPennyDropDialog, setShowPennyDropDialog] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [bulkValidationProgress, setBulkValidationProgress] = useState<{current: number; total: number} | null>(null);
  const [showDeviationDialog, setShowDeviationDialog] = useState(false);
  const [deviationEmail, setDeviationEmail] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<VendorDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch ONLY submitted vendors
  const { data: vendors, isLoading: isLoadingVendors } = useQuery({
    queryKey: ['vendors-for-verification'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('status', 'submitted')
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

  // Get deviations (failed or pending validations)
  const getDeviations = (): Deviation[] => {
    if (!validations) return [];
    
    const deviations: Deviation[] = [];
    const validationTypes = ['gst', 'pan', 'bank', 'name_match', 'msme'];
    
    validationTypes.forEach(type => {
      const validation = validations.find(v => v.validation_type === type);
      if (!validation || validation.status === 'pending') {
        deviations.push({
          type,
          label: validationTypeLabels[type],
          status: 'pending',
          message: validation?.message || 'Validation not yet run'
        });
      } else if (validation.status === 'failed') {
        deviations.push({
          type,
          label: validationTypeLabels[type],
          status: 'failed',
          message: validation.message || 'Validation failed'
        });
      }
    });
    
    return deviations;
  };

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

  // Run Penny Drop validation
  const runPennyDropMutation = useMutation({
    mutationFn: async (vendor: Vendor) => {
      setRunningValidation('penny_drop');
      setPennyDropResult(null);
      setPennyDropStage(0);
      setShowPennyDropDialog(true);

      const stageInterval = setInterval(() => {
        setPennyDropStage(prev => Math.min(prev + 1, 5));
      }, 400);

      const { data, error } = await supabase.functions.invoke('validate-penny-drop', {
        body: {
          accountNumber: vendor.account_number || '1234567890123456',
          ifscCode: vendor.ifsc_code || 'HDFC0001234',
          accountHolderName: vendor.legal_name || 'Unknown',
          vendorName: vendor.legal_name || 'Unknown',
        },
      });

      clearInterval(stageInterval);
      
      if (error) throw error;

      setPennyDropResult(data);
      setPennyDropStage(data.stages?.length || 5);

      await supabase
        .from('vendor_validations')
        .delete()
        .eq('vendor_id', vendor.id)
        .eq('validation_type', 'bank');

      await supabase.from('vendor_validations').insert({
        vendor_id: vendor.id,
        validation_type: 'bank',
        status: data.verified ? 'passed' : 'failed',
        message: `Penny Drop: ${data.message}`,
        details: data,
      });

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: data.verified ? 'Penny Drop Verified' : 'Penny Drop Warning',
        description: data.message,
        variant: data.verified ? 'default' : 'destructive',
      });
      refetchValidations();
    },
    onError: (error) => {
      toast({
        title: 'Penny Drop Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setRunningValidation(null);
    },
  });

  // Run all validations for single vendor
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

  // Bulk validation for multiple vendors
  const runBulkValidationMutation = useMutation({
    mutationFn: async (vendorIds: string[]) => {
      const validationTypes = ['gst', 'pan', 'bank', 'name_match', 'msme'];
      const total = vendorIds.length * validationTypes.length;
      let current = 0;
      
      for (const vendorId of vendorIds) {
        for (const type of validationTypes) {
          try {
            await runValidationMutation.mutateAsync({ vendorId, validationType: type });
          } catch (e) {
            console.error(`Validation ${type} failed for vendor ${vendorId}:`, e);
          }
          current++;
          setBulkValidationProgress({ current, total });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: 'Bulk Validation Complete',
        description: `Validated ${selectedVendors.length} vendors successfully.`,
      });
      setSelectedVendors([]);
      queryClient.invalidateQueries({ queryKey: ['vendors-for-verification'] });
    },
    onSettled: () => {
      setBulkValidationProgress(null);
    },
  });

  // Send deviation email
  const sendDeviationEmail = async () => {
    if (!selectedVendor) return;
    
    setSendingEmail(true);
    const deviations = getDeviations();
    
    try {
      const { error } = await supabase.functions.invoke('send-status-notification', {
        body: {
          vendorId: selectedVendor.id,
          vendorName: selectedVendor.legal_name,
          vendorEmail: selectedVendor.primary_email || deviationEmail,
          status: 'clarification_needed',
          comments: `
Deviations Found:
${deviations.map(d => `- ${d.label}: ${d.message}`).join('\n')}

${additionalComments ? `Additional Comments:\n${additionalComments}` : ''}
          `.trim(),
          simulationMode: true,
        },
      });

      if (error) throw error;

      toast({
        title: 'Email Sent (Simulation)',
        description: `Deviation notice sent to ${selectedVendor.primary_email || deviationEmail}`,
      });
      
      setShowDeviationDialog(false);
      setAdditionalComments('');
    } catch (error: any) {
      toast({
        title: 'Failed to Send Email',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Document preview
  const handlePreview = async (doc: VendorDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('vendor-documents')
        .createSignedUrl(doc.file_path, 3600);
      
      if (error) throw error;
      
      setPreviewUrl(data.signedUrl);
      setPreviewDoc(doc);
    } catch (error) {
      toast({
        title: 'Preview Failed',
        description: 'Could not load document preview.',
        variant: 'destructive',
      });
    }
  };

  // Document download
  const downloadDocument = async (doc: VendorDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('vendor-documents')
        .createSignedUrl(doc.file_path, 60);
      
      if (error) {
        const { data: downloaded, error: downloadError } = await supabase.storage
          .from('vendor-documents')
          .download(doc.file_path);
        
        if (downloadError) {
          toast({
            title: 'Download Failed',
            description: 'Could not download the file.',
            variant: 'destructive',
          });
          return;
        }

        const url = URL.createObjectURL(downloaded);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      window.open(data.signedUrl, '_blank');
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  const getLatestValidation = (type: string): Validation | undefined => {
    return validations?.find(v => v.validation_type === type);
  };

  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendors(prev => 
      prev.includes(vendorId) 
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const selectAllVendors = () => {
    if (selectedVendors.length === vendors?.length) {
      setSelectedVendors([]);
    } else {
      setSelectedVendors(vendors?.map(v => v.id) || []);
    }
  };

  const deviations = selectedVendor ? getDeviations() : [];
  const stageLabels = ["IFSC Validation", "Account Lookup", "IMPS Transfer", "Transfer Confirmation", "Name Verification"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Verification</h1>
          <p className="text-muted-foreground">
            Review and verify submitted vendor documents and run validation checks
          </p>
        </div>
        
        {/* Bulk Validation Button */}
        {selectedVendors.length > 0 && (
          <Button 
            onClick={() => runBulkValidationMutation.mutate(selectedVendors)}
            disabled={runBulkValidationMutation.isPending}
          >
            {runBulkValidationMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating {bulkValidationProgress?.current}/{bulkValidationProgress?.total}
              </>
            ) : (
              <>
                <ListChecks className="mr-2 h-4 w-4" />
                Bulk Validate ({selectedVendors.length})
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Vendors List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Submitted Vendors
              </span>
              {vendors && vendors.length > 0 && (
                <Checkbox
                  checked={selectedVendors.length === vendors.length}
                  onCheckedChange={selectAllVendors}
                />
              )}
            </CardTitle>
            <CardDescription>
              {vendors?.length || 0} vendors pending verification
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-auto">
            {isLoadingVendors ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : vendors?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No submitted vendors pending verification</p>
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
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedVendors.includes(vendor.id)}
                        onCheckedChange={() => toggleVendorSelection(vendor.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div 
                        className="flex-1"
                        onClick={() => setSelectedVendor(vendor)}
                      >
                        <p className="font-medium">{vendor.legal_name || 'Unknown Vendor'}</p>
                        <p className="text-sm text-muted-foreground">{vendor.primary_email}</p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          GST: {vendor.gstin || 'N/A'} | PAN: {vendor.pan || 'N/A'}
                        </div>
                        {vendor.submitted_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Submitted: {new Date(vendor.submitted_at).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Validation Panel */}
        <Card className="lg:col-span-2">
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
              <Tabs defaultValue="validations" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="validations">Standard Validations</TabsTrigger>
                  <TabsTrigger value="penny-drop">Penny Drop</TabsTrigger>
                  <TabsTrigger value="deviations" className="relative">
                    Deviations
                    {deviations.length > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                        {deviations.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="validations" className="space-y-4">
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
                </TabsContent>

                <TabsContent value="penny-drop" className="space-y-4">
                  <Card className="border-dashed">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                          <IndianRupee className="h-8 w-8 text-green-600" />
                          <div>
                            <h4 className="font-semibold">Penny Drop Bank Verification</h4>
                            <p className="text-sm text-muted-foreground">
                              Verify bank account by transferring ₹1 and matching account holder name
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-muted-foreground">Account Number</Label>
                            <p className="font-mono">{selectedVendor.account_number || 'Not provided'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">IFSC Code</Label>
                            <p className="font-mono">{selectedVendor.ifsc_code || 'Not provided'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Bank Name</Label>
                            <p>{selectedVendor.bank_name || 'Not provided'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Account Holder</Label>
                            <p>{selectedVendor.legal_name || 'Not provided'}</p>
                          </div>
                        </div>

                        <Button 
                          onClick={() => runPennyDropMutation.mutate(selectedVendor)}
                          disabled={runPennyDropMutation.isPending}
                          className="w-full"
                        >
                          {runPennyDropMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Running Penny Drop...
                            </>
                          ) : (
                            <>
                              <IndianRupee className="mr-2 h-4 w-4" />
                              Run Penny Drop Verification
                            </>
                          )}
                        </Button>

                        {getLatestValidation('bank')?.message?.includes('Penny Drop') && (
                          <div className={`p-4 rounded-lg border ${
                            getLatestValidation('bank')?.status === 'passed' 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-yellow-50 border-yellow-200'
                          }`}>
                            <div className="flex items-center gap-2">
                              {getLatestValidation('bank')?.status === 'passed' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-yellow-600" />
                              )}
                              <span className="font-medium">Last Penny Drop Result</span>
                            </div>
                            <p className="text-sm mt-1">{getLatestValidation('bank')?.message}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="deviations" className="space-y-4">
                  {deviations.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <p className="text-lg font-medium text-green-700">No Deviations Found</p>
                      <p className="text-muted-foreground">All validations have passed.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="font-medium">{deviations.length} Deviation(s) Found</span>
                        </div>
                        <Button 
                          variant="destructive" 
                          onClick={() => {
                            setDeviationEmail(selectedVendor.primary_email || '');
                            setShowDeviationDialog(true);
                          }}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Send Deviation Notice
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {deviations.map((deviation) => (
                          <div
                            key={deviation.type}
                            className={`p-4 rounded-lg border ${
                              deviation.status === 'failed' 
                                ? 'border-destructive/50 bg-destructive/5' 
                                : 'border-yellow-500/50 bg-yellow-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {deviation.status === 'failed' ? (
                                <XCircle className="h-5 w-5 text-destructive" />
                              ) : (
                                <Clock className="h-5 w-5 text-yellow-600" />
                              )}
                              <div>
                                <p className="font-medium">{deviation.label}</p>
                                <p className="text-sm text-muted-foreground">{deviation.message}</p>
                              </div>
                              <Badge 
                                variant={deviation.status === 'failed' ? 'destructive' : 'secondary'}
                                className="ml-auto"
                              >
                                {deviation.status === 'failed' ? 'Failed' : 'Pending'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents Section with Preview */}
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
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getFileIcon(doc.mime_type)}
                          <span className="capitalize">{documentTypeLabels[doc.document_type] || doc.document_type.replace(/_/g, ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>{doc.file_name}</TableCell>
                      <TableCell>
                        {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {new Date(doc.uploaded_at).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreview(doc)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadDocument(doc)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Penny Drop Progress Dialog */}
      <Dialog open={showPennyDropDialog} onOpenChange={setShowPennyDropDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              Penny Drop Verification
            </DialogTitle>
            <DialogDescription>
              Verifying bank account for {selectedVendor?.legal_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-3">
              {stageLabels.map((stage, index) => {
                const resultStage = pennyDropResult?.stages?.[index];
                const isCompleted = resultStage?.status === 'completed' || pennyDropStage > index;
                const isFailed = resultStage?.status === 'failed';
                const isActive = runPennyDropMutation.isPending && pennyDropStage === index;

                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${isFailed ? 'bg-destructive/10 text-destructive' : 
                        isCompleted ? 'bg-green-100 text-green-700' : 
                        isActive ? 'bg-primary/10 text-primary' : 
                        'bg-muted text-muted-foreground'}
                    `}>
                      {isFailed ? (
                        <XCircle className="h-4 w-4" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${
                        isFailed ? 'text-destructive' : 
                        isCompleted ? 'text-green-700' : 
                        isActive ? 'text-primary' : 
                        'text-muted-foreground'
                      }`}>
                        {stage}
                      </span>
                      {resultStage && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {resultStage.message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {pennyDropResult?.data && (
              <Card className={`border-2 ${pennyDropResult.verified ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    {pennyDropResult.verified ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-yellow-600" />
                    )}
                    <span className="font-semibold text-lg">
                      {pennyDropResult.verified ? 'Account Verified' : 'Verification Warning'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Transaction ID</span>
                      <p className="font-mono font-medium text-xs">{pennyDropResult.data.transactionId}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">UTR Number</span>
                      <p className="font-mono font-medium text-xs">{pennyDropResult.data.utrNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bank</span>
                      <p className="font-medium">{pennyDropResult.data.bankName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Name Match</span>
                      <p className="font-medium">{pennyDropResult.data.nameMatchScore}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Deviation Email Dialog */}
      <Dialog open={showDeviationDialog} onOpenChange={setShowDeviationDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Deviation Notice
            </DialogTitle>
            <DialogDescription>
              Send an email to {selectedVendor?.legal_name} with the list of deviations
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Recipient Email</Label>
              <p className="text-sm font-medium mt-1">{selectedVendor?.primary_email || 'No email provided'}</p>
            </div>

            <div>
              <Label>Deviations to be communicated:</Label>
              <ScrollArea className="h-32 mt-2 border rounded-md p-3">
                <ul className="space-y-2">
                  {deviations.map((d) => (
                    <li key={d.type} className="flex items-center gap-2 text-sm">
                      {d.status === 'failed' ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className="font-medium">{d.label}:</span>
                      <span className="text-muted-foreground">{d.message}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>

            <div>
              <Label htmlFor="comments">Additional Comments</Label>
              <Textarea
                id="comments"
                placeholder="Add any additional instructions or comments for the vendor..."
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeviationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={sendDeviationEmail} disabled={sendingEmail}>
              {sendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewDoc && getFileIcon(previewDoc.mime_type)}
              {previewDoc?.file_name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewDoc?.mime_type?.startsWith('image/') ? (
              <img
                src={previewUrl || ''}
                alt={previewDoc.file_name}
                className="max-w-full max-h-[70vh] mx-auto rounded-md"
              />
            ) : previewDoc?.mime_type === 'application/pdf' ? (
              <iframe
                src={previewUrl || ''}
                className="w-full h-[70vh] rounded-md"
                title={previewDoc.file_name}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Preview not available for this file type
                </p>
                <Button onClick={() => previewUrl && window.open(previewUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
