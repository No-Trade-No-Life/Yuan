// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

console.log(`Function "cors-proxy" up and running!`);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }
  // 解析请求 URL
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');
  console.log('targetUrl:', targetUrl);

  if (!targetUrl) {
    return new Response("Missing 'url' parameter", { headers: corsHeaders, status: 400 });
  }

  try {
    // 转发请求到目标 URL
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'POST' ? await req.text() : undefined,
    });

    // 返回响应
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...response.headers,
        ...corsHeaders,
      },
    });
  } catch (error) {
    return new Response('Failed to fetch data', { headers: corsHeaders, status: 500 });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/cors-proxy' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
