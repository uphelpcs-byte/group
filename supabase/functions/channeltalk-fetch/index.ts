import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  apiKey?: string;
  apiSecret?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { apiKey, apiSecret, from, to } = (await req.json()) as Body;

    if (!apiKey || !apiSecret || !from || !to) {
      return new Response(
        JSON.stringify({ error: 'apiKey, apiSecret, from, to are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sinceMs = new Date(`${from}T00:00:00+09:00`).getTime();
    const untilMs = new Date(`${to}T23:59:59+09:00`).getTime();

    const baseUrl = 'https://api.channel.io/open/v5/user-chats';
    const chats: any[] = [];
    const seenIds = new Set<string>();

    const fetchByState = async (state: 'opened' | 'closed') => {
      let nextCursor: string | undefined = undefined;
      let safety = 0;

      while (safety < 200) {
        safety++;
        const params = new URLSearchParams({
          limit: '100',
          state,
          sortOrder: 'desc',
        });
        if (nextCursor) params.set('since', nextCursor);

        const res = await fetch(`${baseUrl}?${params.toString()}`, {
          method: 'GET',
          headers: {
            'x-access-key': apiKey,
            'x-access-secret': apiSecret,
            'Accept': 'application/json',
          },
        });

        if (!res.ok) {
          const text = await res.text();
          return new Response(
            JSON.stringify({
              error: `Channel.io API error (${res.status})`,
              details: text.slice(0, 500),
              fallback: true,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        const data: any = await res.json();
        const batch: any[] = data.userChats || data.chats || data.data || [];

        for (const c of batch) {
          const inboundAt = Number(c.firstOpenedAt ?? c.openedAt ?? c.createdAt ?? 0);
          const respondedAt = Number(c.firstAnsweredAt ?? c.firstRepliedAt ?? c.firstRepliedAtAfterOpen ?? 0);
          const id = String(c.id ?? '');
          if (!id) continue;

          const inInboundRange = inboundAt >= sinceMs && inboundAt <= untilMs;
          const inResponseRange = respondedAt >= sinceMs && respondedAt <= untilMs;

          if (!inInboundRange && !inResponseRange) continue;
          if (seenIds.has(id)) continue;

          seenIds.add(id);
          chats.push(c);
        }

        const next = data.next;
        if (!next) break;
        nextCursor = String(next);
      }

      return null;
    };

    const openedError = await fetchByState('opened');
    if (openedError) return openedError;
    const closedError = await fetchByState('closed');
    if (closedError) return closedError;

    return new Response(
      JSON.stringify({ chats, count: chats.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Unknown error', fallback: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
