
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

    const { count: todayCount, error: todayError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', boliviaStart);

    console.log("Orders since Bolivia Today Start:", todayCount);
    if (todayError) console.error("Error today:", todayError);

    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 31);
    const { count: monthCount, error: monthError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastMonth.toISOString());

    console.log("Orders last 31 days:", monthCount);
    if (monthError) console.error("Error month:", monthError);

    const { data: summaries, error: sumError } = await supabase
        .from('monthly_summaries')
        .select('*')
        .limit(10);

    console.log("Monthly Summaries sample:", summaries?.length || 0);
    if (sumError) console.error("Error summaries:", sumError);
}

checkData();
