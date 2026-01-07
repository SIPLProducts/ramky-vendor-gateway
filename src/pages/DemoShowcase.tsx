import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PennyDropDemo } from "@/components/vendor/PennyDropDemo";
import { EmailNotificationDemo } from "@/components/vendor/EmailNotificationDemo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, Mail, Shield, FileCheck, Sparkles } from "lucide-react";

export default function DemoShowcase() {
  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Demo Showcase</h1>
          <p className="text-muted-foreground mt-2">
            Interactive demonstrations of key platform features for client presentations
          </p>
        </div>

        {/* Feature Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <IndianRupee className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Penny Drop</p>
                  <p className="text-sm text-muted-foreground">Bank Verification</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Email Alerts</p>
                  <p className="text-sm text-muted-foreground">Status Notifications</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">GST/PAN</p>
                  <p className="text-sm text-muted-foreground">Government APIs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <FileCheck className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium">MSME</p>
                  <p className="text-sm text-muted-foreground">Udyam Verification</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demo Tabs */}
        <Tabs defaultValue="penny-drop" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="penny-drop" className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4" />
              Penny Drop Verification
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="penny-drop">
            <PennyDropDemo />
          </TabsContent>

          <TabsContent value="email">
            <EmailNotificationDemo />
          </TabsContent>
        </Tabs>

        {/* Simulation Mode Notice */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Simulation Mode Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              All demos run in simulation mode for safe client presentations:
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">No real money transfers</Badge>
              <Badge variant="outline">No actual emails sent</Badge>
              <Badge variant="outline">Mock API responses</Badge>
              <Badge variant="outline">Realistic timing simulation</Badge>
              <Badge variant="outline">Full audit logging</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
