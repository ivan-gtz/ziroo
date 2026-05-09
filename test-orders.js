import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://djvuzwtenvqtlpqohhlg.supabase.co';
const supabaseKey = 'sb_publishable_-ZQoy0kg2UDWn6Imm4pypg_dBVLhIlc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const id = '117969fe-8b73-49dd-a9ab-75a9e9151f7f';
  const updatePayload = { is_shared_with_drivers: true, updated_at: new Date().toISOString() };
  const { error } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', id);
            
  console.log("Error:", error);
}
test();
