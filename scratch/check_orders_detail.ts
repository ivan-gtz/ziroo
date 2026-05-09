
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
    const today = new Date();
    const boliviaNow = new Date(today.getTime() - (4 * 60 * 60 * 1000));
    const year = boliviaNow.getUTCFullYear();
    const month = String(boliviaNow.getUTCMonth() + 1).padStart(2, '0');
    const day = String(boliviaNow.getUTCDate()).padStart(2, '0');
    const boliviaStart = `${year}-${month}-${day}T04:00:00.000Z`;
    
    console.log("Checking Bolivia Start:", boliviaStart);

    const { data: todayOrders, error: todayError } = await supabase
        .from('orders')
        .select('id, status, branch_id, created_at, total_amount')
        .gte('created_at', boliviaStart);

    console.log("Orders today detail:", JSON.stringify(todayOrders, null, 2));
}

checkData();
