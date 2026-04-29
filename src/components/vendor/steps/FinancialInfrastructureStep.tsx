import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { TrendingUp, Users, Building, Factory, MapPin, Package, Settings, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUpload } from '@/components/vendor/FileUpload';
import { FinancialDetails, InfrastructureDetails, QHSEDetails, PRODUCT_TYPES, PRODUCTION_FACILITIES, WATER_SUPPLY_TYPES, INSPECTION_TYPES } from '@/types/vendor';
import { Checkbox } from '@/components/ui/checkbox';

const currentYear = new Date().getFullYear();

const schema = z.object({
  // Financial
  turnoverYear1: z.string().optional(),
  turnoverYear2: z.string().optional(),
  turnoverYear3: z.string().optional(),
  creditPeriodExpected: z.string().optional(),
  majorCustomer1: z.string().optional(),
  majorCustomer2: z.string().optional(),
  majorCustomer3: z.string().optional(),
  authorizedDistributorName: z.string().optional(),
  authorizedDistributorAddress: z.string().optional(),
  // Infrastructure
  rawMaterialsUsed: z.string().optional(),
  machineryAvailability: z.string().optional(),
  equipmentAvailability: z.string().optional(),
  powerSupply: z.string().optional(),
  waterSupply: z.string().optional(),
  dgCapacity: z.string().optional(),
  productionCapacity: z.string().optional(),
  storeCapacity: z.string().optional(),
  supplyCapacity: z.string().optional(),
  manpower: z.string().optional(),
  inspectionTesting: z.string().optional(),
  nearestRailway: z.string().optional(),
  nearestBusStation: z.string().optional(),
  nearestAirport: z.string().optional(),
  nearestPort: z.string().optional(),
  productTypes: z.array(z.string()).optional(),
  productTypesOther: z.string().optional(),
  productionFacilities: z.array(z.string()).optional(),
  leadTimeRequired: z.string().optional(),
  // QHSE
  qualityIssues: z.string().optional(),
  healthIssues: z.string().optional(),
  environmentalIssues: z.string().optional(),
  safetyIssues: z.string().optional(),
});

type CombinedFormData = FinancialDetails & InfrastructureDetails & QHSEDetails;

interface FinancialInfrastructureStepProps {
  financialData: FinancialDetails;
  infrastructureData: InfrastructureDetails;
  qhseData: QHSEDetails;
  tenantId?: string | null;
  onNext: (data: { financial: FinancialDetails; infrastructure: InfrastructureDetails; qhse: QHSEDetails }) => void;
  onBack: () => void;
}

export function FinancialInfrastructureStep({ financialData, infrastructureData, qhseData, tenantId: _tenantId, onNext }: FinancialInfrastructureStepProps) {
  const [dealershipCertificateFile, setDealershipCertificateFile] = useState<File | null>(financialData.dealershipCertificateFile);
  const [financialDocsFile, setFinancialDocsFile] = useState<File | null>(financialData.financialDocsFile);
  
  const defaultValues: CombinedFormData = {
    ...financialData,
    ...infrastructureData,
    ...qhseData,
  };

  const { register, handleSubmit, control, watch } = useForm<CombinedFormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const productTypes = watch('productTypes') || [];

  const handleFormSubmit = (formData: CombinedFormData) => {
    const financial: FinancialDetails = {
      turnoverYear1: formData.turnoverYear1 || '',
      turnoverYear2: formData.turnoverYear2 || '',
      turnoverYear3: formData.turnoverYear3 || '',
      creditPeriodExpected: formData.creditPeriodExpected || '',
      majorCustomer1: formData.majorCustomer1 || '',
      majorCustomer2: formData.majorCustomer2 || '',
      majorCustomer3: formData.majorCustomer3 || '',
      authorizedDistributorName: formData.authorizedDistributorName || '',
      authorizedDistributorAddress: formData.authorizedDistributorAddress || '',
      dealershipCertificateFile,
      financialDocsFile,
    };

    const infrastructure: InfrastructureDetails = {
      rawMaterialsUsed: formData.rawMaterialsUsed || '',
      machineryAvailability: formData.machineryAvailability || '',
      equipmentAvailability: formData.equipmentAvailability || '',
      powerSupply: formData.powerSupply || '',
      waterSupply: formData.waterSupply || '',
      dgCapacity: formData.dgCapacity || '',
      productionCapacity: formData.productionCapacity || '',
      storeCapacity: formData.storeCapacity || '',
      supplyCapacity: formData.supplyCapacity || '',
      manpower: formData.manpower || '',
      inspectionTesting: formData.inspectionTesting || '',
      nearestRailway: formData.nearestRailway || '',
      nearestBusStation: formData.nearestBusStation || '',
      nearestAirport: formData.nearestAirport || '',
      nearestPort: formData.nearestPort || '',
      productTypes: formData.productTypes || [],
      productTypesOther: formData.productTypesOther || '',
      productionFacilities: formData.productionFacilities || [],
      leadTimeRequired: formData.leadTimeRequired || '',
    };

    const qhse: QHSEDetails = {
      qualityIssues: formData.qualityIssues || '',
      healthIssues: formData.healthIssues || '',
      environmentalIssues: formData.environmentalIssues || '',
      safetyIssues: formData.safetyIssues || '',
    };

    onNext({ financial, infrastructure, qhse });
  };

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Financial Details */}
      <div className="form-section">
        <h3 className="form-section-title">
          <TrendingUp className="h-5 w-5 text-primary" />
          Audited Turnover (Last 3 Years)
        </h3>
        <Alert className="mb-5">
          <AlertDescription>Please provide CA certified copies of audited financial statements</AlertDescription>
        </Alert>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="turnoverYear1">FY {currentYear - 3}-{(currentYear - 2).toString().slice(-2)}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input id="turnoverYear1" type="number" {...register('turnoverYear1')} placeholder="Amount in Lakhs" className="pl-8" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="turnoverYear2">FY {currentYear - 2}-{(currentYear - 1).toString().slice(-2)}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input id="turnoverYear2" type="number" {...register('turnoverYear2')} placeholder="Amount in Lakhs" className="pl-8" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="turnoverYear3">FY {currentYear - 1}-{currentYear.toString().slice(-2)}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input id="turnoverYear3" type="number" {...register('turnoverYear3')} placeholder="Amount in Lakhs" className="pl-8" />
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="creditPeriodExpected">Expected Credit Period (Days)</Label>
            <Input id="creditPeriodExpected" type="number" {...register('creditPeriodExpected')} placeholder="e.g., 30, 45, 60" />
          </div>
          <FileUpload label="Upload Audited Financial Statements (CA Certified)" accept=".pdf" documentType="financial_docs" onFileSelect={setFinancialDocsFile} currentFile={financialDocsFile} />
        </div>
      </div>

      {/* Major Customers */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Users className="h-5 w-5 text-primary" />
          Existing Major Customers
        </h3>
        <div className="grid md:grid-cols-3 gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="majorCustomer1">Customer 1</Label>
            <Input id="majorCustomer1" {...register('majorCustomer1')} placeholder="Company name" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="majorCustomer2">Customer 2</Label>
            <Input id="majorCustomer2" {...register('majorCustomer2')} placeholder="Company name" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="majorCustomer3">Customer 3</Label>
            <Input id="majorCustomer3" {...register('majorCustomer3')} placeholder="Company name" />
          </div>
        </div>
      </div>

      {/* Authorized Distributor */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Building className="h-5 w-5 text-primary" />
          Authorized Distributor Details
        </h3>
        <p className="text-sm text-muted-foreground mb-4">For Trader/Dealer/Authorized Distributor: Please attach relevant valid dealership certificates</p>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="authorizedDistributorName">Name</Label>
              <Input id="authorizedDistributorName" {...register('authorizedDistributorName')} placeholder="Distributor/Dealer name" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="authorizedDistributorAddress">Address</Label>
              <Input id="authorizedDistributorAddress" {...register('authorizedDistributorAddress')} placeholder="Distributor address" />
            </div>
          </div>
          <FileUpload label="Upload Dealership Certificate" accept=".pdf,.jpg,.jpeg,.png" documentType="dealership_certificate" onFileSelect={setDealershipCertificateFile} currentFile={dealershipCertificateFile} />
        </div>
      </div>

      {/* Manufacturing Facility Details */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Factory className="h-5 w-5 text-primary" />
          Manufacturing Facility Details
        </h3>
        <p className="text-sm text-muted-foreground mb-4">Provide details if applicable</p>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="rawMaterialsUsed">Raw Materials Used</Label>
              <Input id="rawMaterialsUsed" {...register('rawMaterialsUsed')} placeholder="List raw materials" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="machineryAvailability">Machinery Availability</Label>
              <Input id="machineryAvailability" {...register('machineryAvailability')} placeholder="Available machinery" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="equipmentAvailability">Equipment Availability</Label>
              <Input id="equipmentAvailability" {...register('equipmentAvailability')} placeholder="Available equipment" />
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="powerSupply">Power Supply (KV/MW)</Label>
              <Input id="powerSupply" {...register('powerSupply')} placeholder="e.g., 100 KV" />
            </div>
            <div className="grid gap-1.5">
              <Label>Water Supply</Label>
              <Controller
                name="waterSupply"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {WATER_SUPPLY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dgCapacity">DG Capacity (KV)</Label>
              <Input id="dgCapacity" {...register('dgCapacity')} placeholder="e.g., 50 KV" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="productionCapacity">Production Capacity</Label>
              <Input id="productionCapacity" {...register('productionCapacity')} placeholder="Monthly/Annual" />
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="storeCapacity">Store Capacity</Label>
              <Input id="storeCapacity" {...register('storeCapacity')} placeholder="Sq. ft. or Tons" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="supplyCapacity">Supply Capacity</Label>
              <Input id="supplyCapacity" {...register('supplyCapacity')} placeholder="Monthly/Annual" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="manpower">Manpower</Label>
              <Input id="manpower" {...register('manpower')} placeholder="Number of employees" />
            </div>
            <div className="grid gap-1.5">
              <Label>Inspection & Testing</Label>
              <Controller
                name="inspectionTesting"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INSPECTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Connectivity Details */}
      <div className="form-section">
        <h3 className="form-section-title">
          <MapPin className="h-5 w-5 text-primary" />
          Connectivity Details
        </h3>
        <div className="grid md:grid-cols-4 gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="nearestRailway">Nearest Railway Station</Label>
            <Input id="nearestRailway" {...register('nearestRailway')} placeholder="Station name & distance" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nearestBusStation">Nearest Bus Station</Label>
            <Input id="nearestBusStation" {...register('nearestBusStation')} placeholder="Station name & distance" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nearestAirport">Nearest Airport/Field</Label>
            <Input id="nearestAirport" {...register('nearestAirport')} placeholder="Airport name & distance" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nearestPort">Nearest Port</Label>
            <Input id="nearestPort" {...register('nearestPort')} placeholder="Port name & distance" />
          </div>
        </div>
      </div>

      {/* Type of Products & Production Facilities */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Package className="h-5 w-5 text-primary" />
          Type of Products
        </h3>
        <div className="grid gap-5">
          <Controller
            name="productTypes"
            control={control}
            render={({ field }) => (
              <MultiSelect
                options={PRODUCT_TYPES.map((type) => ({ label: type, value: type }))}
                selected={field.value || []}
                onChange={field.onChange}
                placeholder="Select product types"
              />
            )}
          />
          {productTypes.includes('Others') && (
            <div className="grid gap-1.5">
              <Label htmlFor="productTypesOther">Specify Other Products</Label>
              <Input id="productTypesOther" {...register('productTypesOther')} placeholder="Specify other product types" />
            </div>
          )}
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">
          <Settings className="h-5 w-5 text-primary" />
          Production Facilities
        </h3>
        <div className="grid gap-5">
          <Controller
            name="productionFacilities"
            control={control}
            render={({ field }) => (
              <MultiSelect
                options={PRODUCTION_FACILITIES.map((facility) => ({ label: facility, value: facility }))}
                selected={field.value || []}
                onChange={field.onChange}
                placeholder="Select applicable facilities"
              />
            )}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="leadTimeRequired">Lead Time Required</Label>
            <Input id="leadTimeRequired" {...register('leadTimeRequired')} placeholder="e.g., 2-3 weeks" />
          </div>
        </div>
      </div>

      {/* QHSE Details */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Shield className="h-5 w-5 text-primary" />
          QHSE Details (Quality, Health, Safety, Environment)
        </h3>
        <p className="text-sm text-muted-foreground mb-4">Please mention your track record for the following</p>
        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="qualityIssues">Quality Issues</Label>
            <Textarea id="qualityIssues" {...register('qualityIssues')} placeholder="Describe any quality issues and how they were resolved" rows={3} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="healthIssues">Health Issues</Label>
            <Textarea id="healthIssues" {...register('healthIssues')} placeholder="Describe any health issues and preventive measures" rows={3} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="environmentalIssues">Environmental Issues</Label>
            <Textarea id="environmentalIssues" {...register('environmentalIssues')} placeholder="Describe any environmental issues and compliance measures" rows={3} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="safetyIssues">Safety Issues</Label>
            <Textarea id="safetyIssues" {...register('safetyIssues')} placeholder="Describe any safety issues and protocols in place" rows={3} />
          </div>
        </div>
      </div>
    </form>
  );
}
