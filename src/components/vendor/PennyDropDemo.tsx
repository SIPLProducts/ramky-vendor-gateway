import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, IndianRupee, Building2, User, Hash, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export function PennyDropDemo() {
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [result, setResult] = useState<PennyDropResult | null>(null);
  const [formData, setFormData] = useState({
    accountNumber: "1234567890123456",
    ifscCode: "HDFC0001234",
    accountHolderName: "ABC INFRASTRUCTURE PVT LTD",
    vendorName: "ABC Infrastructure Private Limited",
  });

  const handleVerify = async () => {
    setIsVerifying(true);
    setCurrentStage(0);
    setResult(null);

    try {
      // Simulate stage progression for UI
      const stageInterval = setInterval(() => {
        setCurrentStage(prev => Math.min(prev + 1, 5));
      }, 400);

      const { data, error } = await supabase.functions.invoke('validate-penny-drop', {
        body: formData,
      });

      clearInterval(stageInterval);

      if (error) throw error;

      setResult(data);
      setCurrentStage(data.stages?.length || 5);

      toast({
        title: data.verified ? "Verification Successful" : "Verification Failed",
        description: data.message,
        variant: data.verified ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Penny drop error:', error);
      toast({
        title: "Error",
        description: "Failed to perform penny drop verification",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const stageLabels = [
    "IFSC Validation",
    "Account Lookup",
    "IMPS Transfer",
    "Transfer Confirmation",
    "Name Verification",
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5" />
          Penny Drop Verification Demo
        </CardTitle>
        <CardDescription>
          Simulate real-time bank account verification with ₹1 transfer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="accountNumber"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                className="pl-10"
                placeholder="Enter account number"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ifscCode">IFSC Code</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="ifscCode"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                className="pl-10"
                placeholder="Enter IFSC code"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountHolderName">Account Holder Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="accountHolderName"
                value={formData.accountHolderName}
                onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                className="pl-10"
                placeholder="Enter account holder name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendorName">Vendor Name (for matching)</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="vendorName"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                className="pl-10"
                placeholder="Enter vendor name"
              />
            </div>
          </div>
        </div>

        <Button 
          onClick={handleVerify} 
          disabled={isVerifying}
          className="w-full"
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <IndianRupee className="mr-2 h-4 w-4" />
              Run Penny Drop Verification
            </>
          )}
        </Button>

        {/* Progress Stages */}
        {(isVerifying || result) && (
          <div className="space-y-4">
            <h4 className="font-medium">Verification Progress</h4>
            <div className="space-y-3">
              {stageLabels.map((stage, index) => {
                const resultStage = result?.stages?.[index];
                const isCompleted = resultStage?.status === 'completed' || currentStage > index;
                const isFailed = resultStage?.status === 'failed';
                const isActive = isVerifying && currentStage === index;

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
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          isFailed ? 'text-destructive' : 
                          isCompleted ? 'text-green-700' : 
                          isActive ? 'text-primary' : 
                          'text-muted-foreground'
                        }`}>
                          {stage}
                        </span>
                        {resultStage && (
                          <Badge variant={isFailed ? 'destructive' : 'secondary'} className="text-xs">
                            {resultStage.status}
                          </Badge>
                        )}
                      </div>
                      {resultStage && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {resultStage.message}
                        </p>
                      )}
                    </div>
                    {index < stageLabels.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Result Details */}
        {result?.data && (
          <Card className={`border-2 ${result.verified ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-4">
                {result.verified ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-yellow-600" />
                )}
                <span className="font-semibold text-lg">
                  {result.verified ? 'Account Verified' : 'Verification Warning'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Transaction ID</span>
                  <p className="font-mono font-medium">{result.data.transactionId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">UTR Number</span>
                  <p className="font-mono font-medium">{result.data.utrNumber}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bank</span>
                  <p className="font-medium">{result.data.bankName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Branch</span>
                  <p className="font-medium">{result.data.branchName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Account Holder</span>
                  <p className="font-medium">{result.data.accountHolderName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Account Status</span>
                  <Badge variant="outline" className="mt-1">{result.data.accountStatus}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Transfer Amount</span>
                  <p className="font-medium">₹{result.data.transferAmount.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Name Match Score</span>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{result.data.nameMatchScore}%</p>
                    <Badge 
                      variant={result.data.nameMatchStatus === 'exact' ? 'default' : 
                               result.data.nameMatchStatus === 'partial' ? 'secondary' : 'destructive'}
                    >
                      {result.data.nameMatchStatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Response Time</span>
                  <p className="font-medium">{result.data.responseTime}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Demo Instructions */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm">
          <h5 className="font-medium mb-2">Demo Instructions</h5>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>This is a simulation mode - no real money is transferred</li>
            <li>Use account numbers ending in '9' to simulate failed verification</li>
            <li>Name matching uses fuzzy matching algorithm for realistic results</li>
            <li>All major Indian banks are supported in the demo</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
