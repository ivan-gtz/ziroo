require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('orders')
    .select(`
        id, is_shared_with_drivers, assigned_driver_id, status, driver_flow_status, city, country, updated_at, created_at,
        branches (
            id, 
            restaurants (id, city, country)
        )
    `)
    .eq('is_shared_with_drivers', true)
    .order('created_at', { ascending: false })
    .limit(3);
    
  console.log("Orders:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}
test();
