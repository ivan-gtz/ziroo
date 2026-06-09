import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Querying user_profiles...");
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(10);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("User profiles:", JSON.stringify(data, null, 2));
    }
}

test();
