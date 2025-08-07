// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// @ts-ignore
import { createClient } from 'jsr:@supabase/supabase-js@2';

console.log(`Function "npm-dist-checker" up and running!`);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const query = await req.json();
    console.info('query:', JSON.stringify(query));
    // Create a Supabase client with the Auth context of the logged in user.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // And we can run queries in the context of our authenticated user
    const { data, error } = await supabaseClient
      .from('blocked_npm_packages')
      .select('*')
      .eq('package_name', query.package_name);
    if (error) throw error;

    if (data?.length > 0) {
      return new Response(
        JSON.stringify({ code: 1, message: `Package "${query.package_name}" is blocked.` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    return new Response(JSON.stringify({ code: 0, message: 'OK' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ code: -1, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

// DEPLOY: supabase functions deploy npm-dist-checker --project-ref makcbuwrvhmfggzvhtux
