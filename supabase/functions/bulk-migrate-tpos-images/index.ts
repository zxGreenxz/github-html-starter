import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productCodes, batchSize = 5 } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting batch migration for ${productCodes?.length || 'all'} products`);

    // Fetch parent products with TPOS URLs
    let query = supabase
      .from('products')
      .select('id, product_code, product_name, tpos_image_url')
      .not('tpos_image_url', 'is', null)
      .is('base_product_code', null); // Only parent products

    if (productCodes && productCodes.length > 0) {
      query = query.in('product_code', productCodes);
    } else {
      query = query.like('tpos_image_url', '%tpos.vn%');
    }

    const { data: products, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: [], failed: [], message: 'No products to migrate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      success: [] as any[],
      failed: [] as any[],
    };

    // Process in batches
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(product => migrateOneImage(product, supabase))
      );

      batchResults.forEach((result, index) => {
        const product = batch[index];
        if (result.status === 'fulfilled') {
          results.success.push({
            product_code: product.product_code,
            product_name: product.product_name,
            new_url: result.value,
          });
        } else {
          results.failed.push({
            product_code: product.product_code,
            product_name: product.product_name,
            error: result.reason?.message || 'Unknown error',
          });
        }
      });
    }

    console.log(`Migration completed: ${results.success.length} success, ${results.failed.length} failed`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Bulk migration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function migrateOneImage(product: any, supabase: any, retries = 2): Promise<string> {
  try {
    const imageUrl = product.tpos_image_url;
    const productCode = product.product_code;

    console.log(`Migrating ${productCode}: ${imageUrl}`);

    // Download image from TPOS
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const imageBlob = await imageResponse.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const imageBuffer = new Uint8Array(arrayBuffer);

    // Generate filename
    const extension = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `${productCode}.${extension}`;
    const filePath = `products/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('tpos-images')
      .upload(filePath, imageBuffer, {
        contentType: imageBlob.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('tpos-images')
      .getPublicUrl(filePath);

    const newUrl = publicUrlData.publicUrl;

    // Update database
    const { error: updateError } = await supabase
      .from('products')
      .update({ tpos_image_url: newUrl })
      .eq('id', product.id);

    if (updateError) {
      // Rollback: delete uploaded file
      await supabase.storage.from('tpos-images').remove([filePath]);
      throw updateError;
    }

    console.log(`✅ ${productCode} migrated successfully`);
    return newUrl;
  } catch (error) {
    if (retries > 0) {
      console.log(`⚠️ Retry ${3 - retries}/2 for ${product.product_code}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return migrateOneImage(product, supabase, retries - 1);
    }
    console.error(`❌ ${product.product_code} failed:`, error);
    throw error;
  }
}
