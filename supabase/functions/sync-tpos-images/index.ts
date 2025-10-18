import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Updated: 2025-01-15 - Use tpos_credentials table
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRandomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getTPOSHeaders(bearerToken: string) {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9,vi;q=0.8",
    authorization: `Bearer ${bearerToken}`,
    priority: "u=1, i",
    "sec-ch-ua": '"Google Chrome";v="126", "Chromium";v="126", "Not?A_Brand";v="8"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    tposappversion: "5.9.10.1",
    Referer: "https://tomato.tpos.vn/",
    "x-request-id": generateRandomId(),
  };
}

async function fetchTPOSProductsBatch(
  bearerToken: string,
  top: number,
  skip: number
): Promise<any[]> {
  const url = `https://tomato.tpos.vn/odata/ProductTemplate/ODataService.GetViewV2?Active=true&priceId=0&$top=${top}&$orderby=DateCreated+desc&$filter=Active+eq+true&$count=true&$skip=${skip}`;
  
  console.log(`Fetching TPOS products: top=${top}, skip=${skip}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getTPOSHeaders(bearerToken),
  });

  if (!response.ok) {
    console.error(`TPOS API error: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error('Response body:', text);
    throw new Error(`TPOS API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.value || [];
}

async function fetchAllTPOSProducts(bearerToken: string): Promise<any[]> {
  console.log('Starting to fetch all TPOS products...');
  
  // Fetch first batch to get total count
  const firstBatchUrl = `https://tomato.tpos.vn/odata/ProductTemplate/ODataService.GetViewV2?Active=true&priceId=0&$top=1000&$orderby=DateCreated+desc&$filter=Active+eq+true&$count=true&$skip=0`;
  const firstResponse = await fetch(firstBatchUrl, {
    method: 'GET',
    headers: getTPOSHeaders(bearerToken),
  });
  
  if (!firstResponse.ok) {
    throw new Error(`TPOS API returned ${firstResponse.status}`);
  }
  
  const firstData = await firstResponse.json();
  const totalCount = firstData['@odata.count'] || 0;
  console.log(`Total products in TPOS: ${totalCount}`);
  
  const batch1 = firstData.value || [];
  
  // Calculate how many more batches we need
  const remainingCount = totalCount - 1000;
  const batches = [Promise.resolve(batch1)];
  
  if (remainingCount > 0) {
    // Fetch remaining batches in parallel
    for (let skip = 1000; skip < totalCount; skip += 1000) {
      batches.push(fetchTPOSProductsBatch(bearerToken, 1000, skip));
    }
  }
  
  const allBatches = await Promise.all(batches);
  const allProducts = allBatches.flat();
  
  console.log(`Successfully fetched ${allProducts.length} products from TPOS`);
  
  return allProducts;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get active TPOS token from tpos_credentials
    const { data: tposConfig, error: tokenError } = await supabase
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'tpos')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tposConfig) {
      throw new Error('TPOS token not found in database. Please configure it in Settings.');
    }

    const bearerToken = tposConfig.bearer_token;

    console.log('Starting TPOS image sync...');

    // 1. Get ALL products from database (to match by product_code)
    const { data: dbProducts, error: dbError } = await supabase
      .from('products')
      .select('id, product_code, product_name, tpos_product_id, tpos_image_url');

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    console.log(`Found ${dbProducts?.length || 0} products to sync`);

    // 2. Fetch all products from TPOS
    const tposProducts = await fetchAllTPOSProducts(bearerToken);

    // 3. Create a map: DefaultCode -> {Id, ImageUrl}
    const tposProductMap = new Map(
      tposProducts.map((p: any) => [
        p.DefaultCode, 
        { id: p.Id, imageUrl: p.ImageUrl || null }
      ])
    );

    console.log(`Created TPOS product map with ${tposProductMap.size} entries`);

    // 4. Update products by matching product_code with DefaultCode
    let updatedCount = 0;
    let notFoundCount = 0;
    let skippedCount = 0;
    const updateErrors: any[] = [];

    for (const dbProduct of dbProducts || []) {
      const tposProduct = tposProductMap.get(dbProduct.product_code);
      
      if (!tposProduct) {
        notFoundCount++;
        console.log(`Product ${dbProduct.product_code} not found in TPOS`);
        continue;
      }

      // Skip if already up-to-date
      if (dbProduct.tpos_product_id === tposProduct.id && 
          dbProduct.tpos_image_url === tposProduct.imageUrl) {
        skippedCount++;
        continue;
      }

      // Update the product with both tpos_product_id and tpos_image_url
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          tpos_product_id: tposProduct.id,
          tpos_image_url: tposProduct.imageUrl 
        })
        .eq('id', dbProduct.id);

      if (updateError) {
        console.error(`Failed to update product ${dbProduct.product_code}:`, updateError);
        updateErrors.push({
          product_code: dbProduct.product_code,
          error: updateError.message
        });
      } else {
        updatedCount++;
        console.log(`Updated ${dbProduct.product_code}: TPOS ID=${tposProduct.id}, Image=${tposProduct.imageUrl ? 'Yes' : 'No'}`);
      }
    }

    const summary = {
      total_products: dbProducts?.length || 0,
      updated: updatedCount,
      skipped: skippedCount,
      not_found_in_tpos: notFoundCount,
      errors: updateErrors.length,
    };

    console.log('Sync completed:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        updateErrors: updateErrors.length > 0 ? updateErrors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync-tpos-images:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});