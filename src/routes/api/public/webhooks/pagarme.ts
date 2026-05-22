import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// Map Pagar.me event types -> our payments.status enum
function mapEventToStatus(eventType: string): string | null {
  switch (eventType) {
    case 'order.paid':
    case 'charge.paid':
      return 'paid';
    case 'order.payment_failed':
    case 'charge.payment_failed':
      return 'failed';
    case 'charge.refunded':
    case 'order.refunded':
      return 'refunded';
    case 'charge.canceled':
    case 'order.canceled':
    case 'charge.expired':
    case 'order.expired':
      return 'expired';
    case 'charge.pending':
    case 'order.pending':
    case 'charge.processing':
      return 'pending';
    default:
      return null;
  }
}

function extractGatewayIds(payload: any): string[] {
  const ids = new Set<string>();
  const data = payload?.data ?? payload;
  if (!data) return [];

  // Order-level id
  if (typeof data.id === 'string') ids.add(data.id);

  // Charges array (order events)
  if (Array.isArray(data.charges)) {
    for (const c of data.charges) {
      if (c?.id) ids.add(c.id);
      if (c?.order_id) ids.add(c.order_id);
      if (c?.last_transaction?.id) ids.add(c.last_transaction.id);
    }
  }

  // Single charge event
  if (data.order_id) ids.add(data.order_id);
  if (data.last_transaction?.id) ids.add(data.last_transaction.id);

  return Array.from(ids);
}

function verifyBasicAuth(request: Request): boolean {
  const user = process.env.PAGARME_WEBHOOK_USER;
  const pass = process.env.PAGARME_WEBHOOK_PASSWORD;
  if (!user || !pass) return false;

  const header = request.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('basic ')) return false;

  try {
    const decoded = atob(header.slice(6).trim());
    const expected = `${user}:${pass}`;
    if (decoded.length !== expected.length) return false;
    // constant-time compare
    let diff = 0;
    for (let i = 0; i < decoded.length; i++) {
      diff |= decoded.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export const Route = createFileRoute('/api/public/webhooks/pagarme')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyBasicAuth(request)) {
          return new Response('Unauthorized', { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }

        const eventType: string = payload?.type ?? '';
        const newStatus = mapEventToStatus(eventType);

        if (!newStatus) {
          // Acknowledge ignored events with 200 so Pagar.me doesn't retry
          return Response.json({ ok: true, ignored: eventType });
        }

        const gatewayIds = extractGatewayIds(payload);
        if (gatewayIds.length === 0) {
          return Response.json({ ok: true, ignored: 'no_gateway_id' });
        }

        const { data: updated, error } = await supabaseAdmin
          .from('payments')
          .update({ status: newStatus as any })
          .in('gateway_id', gatewayIds)
          .select('id, tenant_id, gateway_id, status');

        if (error) {
          console.error('[pagarme-webhook] update error', error, { eventType, gatewayIds });
          return new Response('DB error', { status: 500 });
        }

        return Response.json({
          ok: true,
          event: eventType,
          status: newStatus,
          updated: updated?.length ?? 0,
        });
      },
    },
  },
});
