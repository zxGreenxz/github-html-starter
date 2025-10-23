import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, productCode, baseProductCode } = await req.json();

    if (!imageUrl || !productCode) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Migrating TPOS image for product: ${productCode}`);

    // Step 1: Fetch image from TPOS (server-to-server, no CORS)
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch TPOS image: ${imageResponse.status}`);
    }

    const imageBlob = await imageResponse.blob();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Extract file extension from content type
    const ext = contentType.split('/')[1] || 'jpg';
    
    // Step 2: Generate filename
    const targetProductCode = baseProductCode || productCode; // Use parent if available
    const filename = `${targetProductCode}-${Date.now()}.${ext}`;

    // Step 3: Upload to Supabase Storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tpos-images')
      .upload(filename, imageBlob, {
        contentType,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }

    // Step 4: Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('tpos-images')
      .getPublicUrl(filename);

    console.log(`Uploaded to: ${publicUrl}`);

    // Step 5: Update database (parent product only)
    const { error: updateError } = await supabase
      .from('products')
      .update({ tpos_image_url: publicUrl })
      .eq('product_code', targetProductCode);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error(`Failed to update database: ${updateError.message}`);
    }

    console.log(`Updated tpos_image_url for ${targetProductCode}`);

    return new Response(JSON.stringify({ 
      success: true,
      newImageUrl: publicUrl,
      migratedProduct: targetProductCode
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
