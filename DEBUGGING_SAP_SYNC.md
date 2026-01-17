# Debugging SAP Sync Integration

## Quick Checklist

### 1. Verify Environment Variables are Set
Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets

Required secrets:
- ✅ `SAP_API_URL` = `https://49.207.9.62:44325/vendor/bp/create?sap-client=100`
- ✅ `SAP_USERNAME` = `s23hana2`
- ✅ `SAP_PASSWORD` = `Sh@rv!3220`

### 2. Verify Edge Function is Deployed
The function `sync-vendor-to-sap` should be visible in:
- Supabase Dashboard → Edge Functions
- Status should be "ACTIVE"

### 3. Check Browser Console
When you click "Approve & Sync", check the browser console (F12) for:
```
Calling SAP sync edge function for vendor: <vendor-id>
SAP sync response: { sapResult: {...}, sapError: null }
SAP sync successful: { success: true, sapVendorCode: "...", ... }
```

### 4. Check Edge Function Logs
Go to Supabase Dashboard → Edge Functions → sync-vendor-to-sap → Logs

Look for:
```
Calling SAP API with payload: [...]
SAP Response: [...]
```

## Common Issues & Solutions

### Issue 1: "Function not found" error
**Solution:** The edge function might not be deployed. Verify in Supabase Dashboard.

### Issue 2: "Unauthorized" or 401 error
**Solution:** 
- Check if environment variables are set correctly
- Verify SAP credentials are correct
- The edge function has `verify_jwt: true`, so make sure the user is authenticated

### Issue 3: No response from edge function
**Solution:**
- Check edge function logs for errors
- Verify the vendor exists in the database
- Check if all required vendor fields are populated

### Issue 4: SAP API returns error
**Solution:**
- Check SAP API logs in edge function logs
- Verify SAP server is accessible
- Check if required SAP fields are properly mapped

## Manual Testing

### Test 1: Check if edge function is callable
Run this in browser console:
```javascript
const { data, error } = await supabase.functions.invoke('sync-vendor-to-sap', {
  body: { vendorId: 'YOUR_VENDOR_ID' }
});
console.log('Result:', data, 'Error:', error);
```

### Test 2: Check vendor data
```javascript
const { data } = await supabase
  .from('vendors')
  .select('*')
  .eq('status', 'purchase_review')
  .limit(1);
console.log('Vendor:', data);
```

### Test 3: Check if SAP credentials are accessible
Go to Edge Function logs and look for the console.log output showing the SAP payload.

## Step-by-Step Debugging

1. **Open Browser DevTools** (F12)
2. **Go to Console tab**
3. **Click "Approve & Sync" button**
4. **Check console output** - you should see:
   - "Calling SAP sync edge function for vendor: ..."
   - "SAP sync response: ..."
   - "SAP sync successful: ..."

5. **If you see an error**, note the error message
6. **Go to Supabase Dashboard** → Edge Functions → sync-vendor-to-sap → Logs
7. **Check the logs** for detailed error information

## Expected Flow

1. User clicks "Approve & Sync"
2. Frontend calls `usePurchaseAction` hook
3. Hook updates vendor status to `purchase_approved`
4. Hook calls `supabase.functions.invoke('sync-vendor-to-sap', { body: { vendorId } })`
5. Edge function:
   - Fetches vendor from database
   - Maps fields to SAP format
   - Calls SAP API with Basic Auth
   - Parses response
   - Updates vendor with SAP code
   - Returns success response
6. Frontend shows success dialog with SAP vendor code

## Logs to Check

### Browser Console Logs
```
Calling SAP sync edge function for vendor: abc-123-def
SAP sync response: {
  sapResult: {
    success: true,
    sapVendorCode: "0000052056",
    message: "Vendor successfully synced to SAP",
    sapResponse: [...]
  },
  sapError: null
}
```

### Edge Function Logs (Supabase Dashboard)
```
Calling SAP API with payload: [{
  "BPARTNER": "",
  "PARTN_CAT": "1",
  "NAME1": "Test Vendor",
  ...
}]
SAP Response: [{
  "BP_LIFNR": "0000052056",
  "MSGTYP": "S",
  "MSG": "Business Partner Created",
  ...
}]
```

## If Nothing Works

1. Check if the edge function is actually deployed (should see it in Supabase Dashboard)
2. Verify environment variables are set (go to Project Settings → Edge Functions → Secrets)
3. Check edge function logs for any startup errors
4. Try redeploying the edge function
5. Check if SAP server is accessible from Supabase (network/firewall issues)

## Contact Points

- Edge Function Name: `sync-vendor-to-sap`
- Frontend Hook: `usePurchaseAction` in `src/hooks/useVendors.tsx`
- UI Component: `PurchaseApproval.tsx`
