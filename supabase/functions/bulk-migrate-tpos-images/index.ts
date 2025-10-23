import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MigrationRequest {
  productIds: string[];
}

interface MigrationResult {
  productId: string;
  tposProductId: number;
  productCode: string;
  status: 'success' | 'failed' | 'skipped';
  oldUrl?: string;
  newUrl?: string;
  error?: string;
  duration?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { productIds } = await req.json() as MigrationRequest;

    if (!productIds || productIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No product IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚀 Starting migration for ${productIds.length} products`);

    const results: MigrationResult[] = [];

    for (const productId of productIds) {
      const startTime = Date.now();
      
      try {
        // 1. Fetch product
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('id, product_code, tpos_product_id, tpos_image_url')
          .eq('id', productId)
          .single();

        if (fetchError || !product) {
          results.push({
            productId,
            tposProductId: 0,
            productCode: '',
            status: 'failed',
            error: 'Product not found',
            duration: Date.now() - startTime,
          });
          continue;
        }

        const { tpos_product_id, tpos_image_url, product_code } = product;

        if (!tpos_product_id || !tpos_image_url) {
          results.push({
            productId,
            tposProductId: tpos_product_id || 0,
            productCode: product_code,
            status: 'skipped',
            error: 'No TPOS image URL',
            duration: Date.now() - startTime,
          });
          continue;
        }

        // Check if already migrated (Supabase URL)
        if (tpos_image_url.includes('supabase.co/storage')) {
          results.push({
            productId,
            tposProductId: tpos_product_id,
            productCode: product_code,
            status: 'skipped',
            oldUrl: tpos_image_url,
            error: 'Already migrated',
            duration: Date.now() - startTime,
          });
          continue;
        }

        console.log(`📥 Downloading image for ${product_code} (${tpos_product_id})`);

        // 2. Download image with retries
        let imageBlob: Blob | null = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const response = await fetch(tpos_image_url, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            imageBlob = await response.blob();
            break;
          } catch (err) {
            lastError = err as Error;
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.log(`⚠️ Attempt ${attempt}/2 failed: ${errorMsg}`);
            if (attempt < 2) {
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
          }
        }

        if (!imageBlob) {
          results.push({
            productId,
            tposProductId: tpos_product_id,
            productCode: product_code,
            status: 'failed',
            oldUrl: tpos_image_url,
            error: `Download failed: ${lastError?.message}`,
            duration: Date.now() - startTime,
          });
          continue;
        }

        // 3. Determine file extension
        const contentType = imageBlob.type || 'image/jpeg';
        const ext = contentType.split('/')[1] || 'jpg';
        const fileName = `${tpos_product_id}.${ext}`;

        console.log(`📤 Uploading to Supabase: ${fileName}`);

        // 4. Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('tpos-images')
          .upload(fileName, imageBlob, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          results.push({
            productId,
            tposProductId: tpos_product_id,
            productCode: product_code,
            status: 'failed',
            oldUrl: tpos_image_url,
            error: `Upload failed: ${uploadError.message}`,
            duration: Date.now() - startTime,
          });
          continue;
        }

        // 5. Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('tpos-images')
          .getPublicUrl(fileName);

        const newUrl = publicUrlData.publicUrl;

        console.log(`💾 Updating database for ${product_code}`);

        // 6. Update database
        const { error: updateError } = await supabase
          .from('products')
          .update({ tpos_image_url: newUrl })
          .eq('tpos_product_id', tpos_product_id);

        if (updateError) {
          // Rollback: delete uploaded file
          await supabase.storage.from('tpos-images').remove([fileName]);
          
          results.push({
            productId,
            tposProductId: tpos_product_id,
            productCode: product_code,
            status: 'failed',
            oldUrl: tpos_image_url,
            error: `DB update failed: ${updateError.message}`,
            duration: Date.now() - startTime,
          });
          continue;
        }

        results.push({
          productId,
          tposProductId: tpos_product_id,
          productCode: product_code,
          status: 'success',
          oldUrl: tpos_image_url,
          newUrl: newUrl,
          duration: Date.now() - startTime,
        });

        console.log(`✅ Success: ${product_code} (${Date.now() - startTime}ms)`);

      } catch (err) {
        console.error(`❌ Error processing ${productId}:`, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({
          productId,
          tposProductId: 0,
          productCode: '',
          status: 'failed',
          error: errorMsg,
          duration: Date.now() - startTime,
        });
      }
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    };

    console.log(`📊 Summary: ${summary.success}✅ ${summary.failed}❌ ${summary.skipped}⏭️`);

    return new Response(
      JSON.stringify({ results, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Function error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
