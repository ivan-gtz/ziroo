import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Signing in...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'super@ziroo.app',
        password: 'superadmin'
    });

    if (authError) {
        console.error("Auth error:", authError);
        return;
    }

    console.log("Logged in successfully! User ID:", authData.user.id);

    // Get order_item_extras
    const { data: extras, error: extrasError } = await supabase
        .from('order_item_extras')
        .select(`
            id,
            order_item_id,
            extra_id,
            name_snapshot,
            price_at_time
        `)
        .order('id', { ascending: false })
        .limit(10);

    if (extrasError) {
        console.error("Error fetching order_item_extras:", extrasError);
    } else {
        console.log("LAST 10 ORDER ITEM EXTRAS:");
        console.log(JSON.stringify(extras, null, 2));
    }

    // Also get last 3 orders with items and extras
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
            id,
            daily_ticket_number,
            status,
            created_at,
            order_items (
                id,
                name_snapshot,
                menu_item_id,
                variation_id,
                order_item_extras (
                    id,
                    extra_id,
                    name_snapshot,
                    price_at_time
                )
            )
        `)
        .order('created_at', { ascending: false })
        .limit(3);

    if (ordersError) {
        console.error("Error fetching orders:", ordersError);
    } else {
        console.log("LAST 3 ORDERS WITH ITEMS & EXTRAS:");
        console.log(JSON.stringify(orders, null, 2));
    }
}

test();
