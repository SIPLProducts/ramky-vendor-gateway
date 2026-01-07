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
import { Progress } from '@/components/ui/progress';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Shield, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Play,
  Loader2,
  FileText,
  TrendingUp,
  TrendingDown,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';

interface Vendor {
  id: string;
  legal_name: string | null;
  gstin: string | null;
  pan: string | null;
  status: string;
  primary_email: string | null;
}

interface GstComplianceResult {
  gstin: string;
  legalName: string;
  tradeName: string;
  status: 'Active' | 'Inactive' | 'Cancelled' | 'Suspended';
  registrationDate: string;
  lastFiledReturn: string;
  filingStatus: 'Regular' | 'Delayed' | 'Defaulter';
  returnsFiled: {
    period: string;
    type: string;
    filedOn: string;
    status: 'Filed' | 'Pending' | 'Late';
  }[];
  complianceScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

interface VendorComplianceStatus {
  vendorId: string;
  vendorName: string;
  gstin: string;
  lastChecked: string | null;
  status: 'compliant' | 'non_compliant' | 'at_risk' | 'pending';
  complianceScore: number | null;
  riskLevel: string | null;
  gstStatus: string | null;
  filingStatus: string | null;
}

export default function GstCompliance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [checkingVendor, setCheckingVendor] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{current: number; total: number} | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [currentResult, setCurrentResult] = useState<GstComplianceResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch all approved vendors (those with GST numbers)
  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors-gst-compliance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .not('gstin', 'is', null)
        .not('status', 'eq', 'draft')
        .order('legal_name');
      
      if (error) throw error;
      return data as Vendor[];
    },
  });

  // Fetch latest GST validations for all vendors
  const { data: validations } = useQuery({
    queryKey: ['gst-validations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_validations')
        .select('*')
        .eq('validation_type', 'gst')
        .order('validated_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Get compliance status for each vendor
  const getVendorComplianceStatus = (vendor: Vendor): VendorComplianceStatus => {
    const validation = validations?.find(v => v.vendor_id === vendor.id);
    
    if (!validation) {
      return {
        vendorId: vendor.id,
        vendorName: vendor.legal_name || 'Unknown',
        gstin: vendor.gstin || '',
        lastChecked: null,
        status: 'pending',
        complianceScore: null,
        riskLevel: null,
        gstStatus: null,
        filingStatus: null,
      };
    }

    const details = validation.details as any;
    const complianceScore = details?.complianceScore || (validation.status === 'passed' ? 85 : 40);
    
    let status: 'compliant' | 'non_compliant' | 'at_risk' | 'pending' = 'pending';
    if (validation.status === 'passed' && complianceScore >= 80) {
      status = 'compliant';
    } else if (validation.status === 'failed' || complianceScore < 50) {
      status = 'non_compliant';
    } else if (complianceScore < 80) {
      status = 'at_risk';
    }

    return {
      vendorId: vendor.id,
      vendorName: vendor.legal_name || 'Unknown',
      gstin: vendor.gstin || '',
      lastChecked: validation.validated_at,
      status,
      complianceScore,
      riskLevel: details?.riskLevel || (complianceScore >= 80 ? 'Low' : complianceScore >= 50 ? 'Medium' : 'High'),
      gstStatus: details?.gstStatus || (validation.status === 'passed' ? 'Active' : 'Unknown'),
      filingStatus: details?.filingStatus || (validation.status === 'passed' ? 'Regular' : 'Unknown'),
    };
  };

  // Run GST compliance check
  const runComplianceCheck = useMutation({
    mutationFn: async (vendor: Vendor) => {
      setCheckingVendor(vendor.id);
      
      // Call GST validation function
      const { data, error } = await supabase.functions.invoke('validate-gst', {
        body: { gstin: vendor.gstin, legalName: vendor.legal_name },
      });

      if (error) throw error;

      // Generate simulated compliance data
      const complianceResult: GstComplianceResult = {
        gstin: vendor.gstin || '',
        legalName: data.legalName || vendor.legal_name || '',
        tradeName: data.tradeName || vendor.legal_name || '',
        status: data.valid ? 'Active' : 'Inactive',
        registrationDate: '2019-07-01',
        lastFiledReturn: format(new Date(), 'MMM yyyy'),
        filingStatus: data.valid ? 'Regular' : 'Delayed',
        returnsFiled: [
          { period: format(new Date(), 'MMM yyyy'), type: 'GSTR-3B', filedOn: format(new Date(), 'dd/MM/yyyy'), status: 'Filed' },
          { period: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'MMM yyyy'), type: 'GSTR-3B', filedOn: format(new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), 'dd/MM/yyyy'), status: 'Filed' },
          { period: format(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), 'MMM yyyy'), type: 'GSTR-3B', filedOn: format(new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), 'dd/MM/yyyy'), status: data.valid ? 'Filed' : 'Late' },
        ],
        complianceScore: data.valid ? Math.floor(Math.random() * 15) + 85 : Math.floor(Math.random() * 30) + 40,
        riskLevel: data.valid ? 'Low' : 'Medium',
      };

      // Update validation with compliance details
      await supabase
        .from('vendor_validations')
        .delete()
        .eq('vendor_id', vendor.id)
        .eq('validation_type', 'gst');

      await supabase.from('vendor_validations').insert({
        vendor_id: vendor.id,
        validation_type: 'gst',
        status: data.valid ? 'passed' : 'failed',
        message: `GST Compliance: ${complianceResult.filingStatus} filer, Score: ${complianceResult.complianceScore}%`,
        details: {
          ...data,
          complianceScore: complianceResult.complianceScore,
          riskLevel: complianceResult.riskLevel,
          gstStatus: complianceResult.status,
          filingStatus: complianceResult.filingStatus,
          lastFiledReturn: complianceResult.lastFiledReturn,
          returnsFiled: complianceResult.returnsFiled,
        },
      });

      return complianceResult;
    },
    onSuccess: (data) => {
      setCurrentResult(data);
      setShowResultDialog(true);
      toast({
        title: 'Compliance Check Complete',
        description: `GST compliance score: ${data.complianceScore}%`,
      });
      queryClient.invalidateQueries({ queryKey: ['gst-validations'] });
    },
    onError: (error) => {
      toast({
        title: 'Compliance Check Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setCheckingVendor(null);
    },
  });

  // Bulk compliance check
  const runBulkComplianceCheck = useMutation({
    mutationFn: async (vendorIds: string[]) => {
      const total = vendorIds.length;
      let current = 0;
      
      for (const vendorId of vendorIds) {
        const vendor = vendors?.find(v => v.id === vendorId);
        if (vendor) {
          try {
            await runComplianceCheck.mutateAsync(vendor);
          } catch (e) {
            console.error(`Compliance check failed for ${vendor.legal_name}:`, e);
          }
        }
        current++;
        setBulkProgress({ current, total });
      }
    },
    onSuccess: () => {
      toast({
        title: 'Bulk Compliance Check Complete',
        description: `Checked ${selectedVendors.length} vendors`,
      });
      setSelectedVendors([]);
    },
    onSettled: () => {
      setBulkProgress(null);
    },
  });

  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendors(prev => 
      prev.includes(vendorId) 
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const selectAllVendors = () => {
    if (selectedVendors.length === filteredVendors?.length) {
      setSelectedVendors([]);
    } else {
      setSelectedVendors(filteredVendors?.map(v => v.id) || []);
    }
  };

  const getStatusBadge = (status: VendorComplianceStatus['status']) => {
    switch (status) {
      case 'compliant':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Compliant</Badge>;
      case 'non_compliant':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Non-Compliant</Badge>;
      case 'at_risk':
        return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />At Risk</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getRiskBadge = (risk: string | null) => {
    switch (risk) {
      case 'Low':
        return <Badge variant="outline" className="text-green-600 border-green-600">Low</Badge>;
      case 'Medium':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Medium</Badge>;
      case 'High':
        return <Badge variant="outline" className="text-red-600 border-red-600">High</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const complianceStatuses = vendors?.map(v => getVendorComplianceStatus(v)) || [];
  
  const filteredVendors = vendors?.filter(v => {
    if (filterStatus === 'all') return true;
    const status = getVendorComplianceStatus(v);
    return status.status === filterStatus;
  });

  const stats = {
    total: complianceStatuses.length,
    compliant: complianceStatuses.filter(s => s.status === 'compliant').length,
    nonCompliant: complianceStatuses.filter(s => s.status === 'non_compliant').length,
    atRisk: complianceStatuses.filter(s => s.status === 'at_risk').length,
    pending: complianceStatuses.filter(s => s.status === 'pending').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">GST Compliance Monitoring</h1>
          <p className="text-muted-foreground">
            Periodic GST compliance checks for all registered vendors
          </p>
        </div>
        
        {selectedVendors.length > 0 && (
          <Button 
            onClick={() => runBulkComplianceCheck.mutate(selectedVendors)}
            disabled={runBulkComplianceCheck.isPending}
          >
            {runBulkComplianceCheck.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking {bulkProgress?.current}/{bulkProgress?.total}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Check Selected ({selectedVendors.length})
              </>
            )}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Vendors</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compliant</p>
                <p className="text-2xl font-bold text-green-600">{stats.compliant}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Non-Compliant</p>
                <p className="text-2xl font-bold text-red-600">{stats.nonCompliant}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">At Risk</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.atRisk}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Check</p>
                <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendors Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Vendor GST Compliance Status
              </CardTitle>
              <CardDescription>
                Monitor and verify GST filing compliance for all vendors
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              {filteredVendors && filteredVendors.length > 0 && (
                <Checkbox
                  checked={selectedVendors.length === filteredVendors.length}
                  onCheckedChange={selectAllVendors}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredVendors?.length ? (
            <p className="text-center py-8 text-muted-foreground">No vendors with GST numbers found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Compliance Score</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Last Checked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.map((vendor) => {
                  const compliance = getVendorComplianceStatus(vendor);
                  return (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedVendors.includes(vendor.id)}
                          onCheckedChange={() => toggleVendorSelection(vendor.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{vendor.legal_name}</TableCell>
                      <TableCell className="font-mono text-sm">{vendor.gstin}</TableCell>
                      <TableCell>{getStatusBadge(compliance.status)}</TableCell>
                      <TableCell>
                        {compliance.complianceScore !== null ? (
                          <div className="flex items-center gap-2">
                            <Progress value={compliance.complianceScore} className="w-20 h-2" />
                            <span className="text-sm font-medium">{compliance.complianceScore}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getRiskBadge(compliance.riskLevel)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {compliance.lastChecked 
                          ? format(new Date(compliance.lastChecked), 'dd MMM yyyy HH:mm')
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runComplianceCheck.mutate(vendor)}
                          disabled={checkingVendor === vendor.id}
                        >
                          {checkingVendor === vendor.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Check
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Compliance Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              GST Compliance Report
            </DialogTitle>
            <DialogDescription>
              Detailed compliance information for {currentResult?.legalName}
            </DialogDescription>
          </DialogHeader>
          
          {currentResult && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card className={currentResult.complianceScore >= 80 ? 'border-green-200 bg-green-50' : currentResult.complianceScore >= 50 ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Compliance Score</p>
                    <p className={`text-3xl font-bold ${currentResult.complianceScore >= 80 ? 'text-green-600' : currentResult.complianceScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {currentResult.complianceScore}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">GST Status</p>
                    <p className="text-lg font-semibold">{currentResult.status}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Risk Level</p>
                    <p className="text-lg font-semibold">{currentResult.riskLevel}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">GSTIN</p>
                  <p className="font-mono font-medium">{currentResult.gstin}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Registration Date</p>
                  <p className="font-medium">{currentResult.registrationDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Filing Status</p>
                  <p className="font-medium">{currentResult.filingStatus}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Filed Return</p>
                  <p className="font-medium">{currentResult.lastFiledReturn}</p>
                </div>
              </div>

              {/* Return History */}
              <div>
                <h4 className="font-medium mb-3">Recent Returns Filed</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Return Type</TableHead>
                      <TableHead>Filed On</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentResult.returnsFiled.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{r.period}</TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell>{r.filedOn}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === 'Filed' ? 'default' : r.status === 'Late' ? 'destructive' : 'secondary'}>
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
