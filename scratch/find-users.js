import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(10);

    if (usersError) {
        console.error("Error fetching user_profiles:", usersError);
        return;
    }

    console.log("USERS:");
    console.log(JSON.stringify(users, null, 2));
}

test();
