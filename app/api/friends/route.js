import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase-server';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ friends: [] });

        const serviceClient = createServiceClient();

        const { data: invites } = await serviceClient
            .from('invites')
            .select('invitee_email')
            .eq('inviter_id', user.id)
            .eq('accepted', true);

        if (!invites?.length) return NextResponse.json({ friends: [] });

        const emails = invites.map((i) => i.invitee_email);

        const { data: authUsers } = await serviceClient
            .from('auth.users')
            .select('id, email')
            .in('email', emails);

        if (!authUsers?.length) return NextResponse.json({ friends: [] });

        const ids = authUsers.map((u) => u.id);

        const { data: profiles } = await serviceClient
            .from('users')
            .select('id, display_name')
            .in('id', ids);

        const friends = (profiles ?? []).map((p) => {
            const authUser = authUsers.find((a) => a.id === p.id);
            return { id: p.id, display_name: p.display_name || authUser?.email };
        });

        return NextResponse.json({ friends });
    } catch (err) {
        console.error('[/api/friends]', err);
        return NextResponse.json({ friends: [] });
    }
}