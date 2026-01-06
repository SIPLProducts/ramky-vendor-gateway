import { supabase } from '@/integrations/supabase/client';

// Sample document data for testing
const sampleDocuments = [
  {
    document_type: 'pan_card',
    file_name: 'PAN_Card_Sample.pdf',
    mime_type: 'application/pdf',
    file_size: 245760,
  },
  {
    document_type: 'gst_certificate',
    file_name: 'GST_Certificate_27AABCU9603R1ZM.pdf',
    mime_type: 'application/pdf',
    file_size: 512000,
  },
  {
    document_type: 'cancelled_cheque',
    file_name: 'Cancelled_Cheque_HDFC.jpg',
    mime_type: 'image/jpeg',
    file_size: 156000,
  },
  {
    document_type: 'msme_certificate',
    file_name: 'MSME_Udyam_Certificate.pdf',
    mime_type: 'application/pdf',
    file_size: 320000,
  },
  {
    document_type: 'incorporation_certificate',
    file_name: 'Certificate_of_Incorporation.pdf',
    mime_type: 'application/pdf',
    file_size: 480000,
  },
];

export async function addSampleDocumentsForVendor(vendorId: string) {
  try {
    // Check if documents already exist for this vendor
    const { data: existingDocs } = await supabase
      .from('vendor_documents')
      .select('id')
      .eq('vendor_id', vendorId);

    if (existingDocs && existingDocs.length > 0) {
      console.log('Sample documents already exist for this vendor');
      return { success: true, message: 'Documents already exist' };
    }

    // Insert sample document records
    const documentsToInsert = sampleDocuments.map((doc, index) => ({
      vendor_id: vendorId,
      document_type: doc.document_type,
      file_name: doc.file_name,
      file_path: `${vendorId}/${doc.document_type}/${doc.file_name}`,
      mime_type: doc.mime_type,
      file_size: doc.file_size,
    }));

    const { data, error } = await supabase
      .from('vendor_documents')
      .insert(documentsToInsert)
      .select();

    if (error) {
      console.error('Error adding sample documents:', error);
      return { success: false, error };
    }

    console.log('Sample documents added successfully:', data);
    return { success: true, data };
  } catch (err) {
    console.error('Error in addSampleDocumentsForVendor:', err);
    return { success: false, error: err };
  }
}

export async function addSampleDocumentsForAllVendors() {
  try {
    // Get all vendors
    const { data: vendors, error: vendorError } = await supabase
      .from('vendors')
      .select('id')
      .not('status', 'eq', 'draft');

    if (vendorError) {
      console.error('Error fetching vendors:', vendorError);
      return { success: false, error: vendorError };
    }

    if (!vendors || vendors.length === 0) {
      return { success: true, message: 'No vendors found' };
    }

    // Add sample documents for each vendor
    const results = await Promise.all(
      vendors.map((vendor) => addSampleDocumentsForVendor(vendor.id))
    );

    const successCount = results.filter((r) => r.success).length;
    return {
      success: true,
      message: `Added sample documents for ${successCount}/${vendors.length} vendors`,
    };
  } catch (err) {
    console.error('Error in addSampleDocumentsForAllVendors:', err);
    return { success: false, error: err };
  }
}
