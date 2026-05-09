const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://djvuzwtenvqtlpqohhlg.supabase.co', 'sb_publishable_-ZQoy0kg2UDWn6Imm4pypg_dBVLhIlc');

const branchId = 'test_branch_123';
const channel = supabase.channel(`branch_orders_staff_${branchId}`, {
    config: { broadcast: { ack: true } }
});

channel.on('broadcast', { event: 'order_updated' }, (payload) => {
    console.log("RECEIVED BROADCAST:", payload);
    process.exit(0);
}).subscribe(async (status) => {
    console.log("Subscribed status:", status);
    if (status === 'SUBSCRIBED') {
        console.log("Sending broadcast...");
        const res = await channel.send({
            type: 'broadcast',
            event: 'order_updated',
            payload: { orderId: 'test_123', action: 'created' }
        });
        console.log("Send result:", res);
    }
});

setTimeout(() => {
    console.log("Timeout waiting for broadcast");
    process.exit(1);
}, 5000);
