import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const branchId = url.searchParams.get('id')

    if (!branchId) {
      return new Response('Branch ID is required', { status: 400 })
    }

    // Connect to Supabase DB using environment variables automatically set in Edge Functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch branch settings from the branches table
    const { data: branch, error } = await supabase
      .from('branches')
      .select('name, settings')
      .eq('id', branchId)
      .single()

    if (error || !branch) {
      console.error('Error fetching branch settings:', error)
      return new Response('Branch not found', { status: 404 })
    }

    const settings = branch.settings || {}
    const restaurantName = settings.restaurantName || branch.name || 'Menú Digital'
    const shareTitle = settings.shareTitle || restaurantName
    const shareDescription = settings.shareDescription || '¡Mira nuestro menú y pide en línea!'
    const logoImage = settings.logoImage || 'https://ziroo.app/logo-green.png'

    // Return HTML page with OpenGraph tags and redirection scripts
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${shareTitle}</title>
  
  <!-- OpenGraph meta tags for social sharing -->
  <meta property="og:title" content="${shareTitle}" />
  <meta property="og:description" content="${shareDescription}" />
  <meta property="og:image" content="${logoImage}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://ziroo.app/m/${branchId}" />
  
  <!-- Twitter Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${shareTitle}" />
  <meta name="twitter:description" content="${shareDescription}" />
  <meta name="twitter:image" content="${logoImage}" />

  <!-- Immediately redirect the client to the actual menu page -->
  <script>
    window.location.replace("https://ziroo.app/#/customer/branch/${branchId}/table/0");
  </script>
  <meta http-equiv="refresh" content="0; url=https://ziroo.app/#/customer/branch/${branchId}/table/0">
</head>
<body>
  <div style="font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; color: #333; background: #f9f9f9;">
    <img src="${logoImage}" alt="${restaurantName}" style="max-width: 120px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <h1 style="font-size: 24px; margin-bottom: 8px;">${restaurantName}</h1>
    <p style="font-size: 16px; color: #666; margin-bottom: 24px;">Redireccionando al menú...</p>
    <a href="https://ziroo.app/#/customer/branch/${branchId}/table/0" style="padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver Menú</a>
  </div>
</body>
</html>`

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response('Internal Server Error', { status: 500 })
  }
})
