import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  MapPin, 
  Users, 
  FileCheck, 
  Landmark, 
  TrendingUp, 
  CheckCircle2,
  Mail,
  Eye,
  ArrowRight
} from 'lucide-react';

const registrationSteps = [
  { id: 1, title: 'Organization Profile', description: 'Company name, type, and industry details', icon: Building2 },
  { id: 2, title: 'Address Information', description: 'Registered, manufacturing & branch addresses', icon: MapPin },
  { id: 3, title: 'Contact Details', description: 'Key contact persons and their information', icon: Users },
  { id: 4, title: 'Commercial Details', description: 'GST, PAN, MSME verification with document uploads', icon: FileCheck },
  { id: 5, title: 'Bank Details', description: 'Bank account verification via penny drop', icon: Landmark },
  { id: 6, title: 'Financial & Infrastructure', description: 'Turnover, facility details & QHSE compliance', icon: TrendingUp },
  { id: 7, title: 'Review & Submit', description: 'Verify all details and submit application', icon: CheckCircle2 },
];

export default function VendorRegistrationPreview() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Vendor Registration Form</h1>
          </div>
          <p className="text-muted-foreground">Preview of the vendor registration process</p>
        </div>
        <Link to="/admin/invitations">
          <Button className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600">
            <Mail className="h-4 w-4 mr-2" />
            Send Invitation
          </Button>
        </Link>
      </div>

      {/* Info Card */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">How Vendor Registration Works</h3>
              <p className="text-muted-foreground">
                Vendors receive an invitation email with a secure link. They complete the 7-step registration form, 
                upload required documents (PAN & GST certificates), and submit for review. The form includes 
                real-time verification of GST, PAN, and bank details.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration Steps Preview */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Registration Steps
          </CardTitle>
          <CardDescription>
            The vendor registration form consists of 7 comprehensive steps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {registrationSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div 
                  key={step.id} 
                  className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Step {step.id}</Badge>
                      <h4 className="font-medium">{step.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                  </div>
                  {index < registrationSteps.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Key Features */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Real-time Verification</h3>
            <p className="text-sm text-muted-foreground">
              GST, PAN, and bank details are verified in real-time through government APIs
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <FileCheck className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Document Upload</h3>
            <p className="text-sm text-muted-foreground">
              Mandatory PAN card and GST certificate uploads with optional MSME certificate
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
              <Landmark className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-2">Penny Drop Verification</h3>
            <p className="text-sm text-muted-foreground">
              Bank account verification through ₹1 transfer with name matching
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
