import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = parseInt(params.id);
    
    if (isNaN(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    // Get total participants count for this event
    const [totalParticipants] = await db.execute(`
      SELECT COUNT(DISTINCT p.id) as total
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      WHERE t.event_id = ? AND t.is_verified = TRUE
    `, [eventId]);

    // Get participants with certificates count
    const [participantsWithCerts] = await db.execute(`
      SELECT COUNT(DISTINCT p.id) as with_certificates
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      JOIN certificates c ON p.id = c.participant_id
      WHERE t.event_id = ? AND t.is_verified = TRUE
    `, [eventId]);

    // Get participants without certificates count
    const [participantsWithoutCerts] = await db.execute(`
      SELECT COUNT(DISTINCT p.id) as without_certificates
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      LEFT JOIN certificates c ON p.id = c.participant_id
      WHERE t.event_id = ? AND t.is_verified = TRUE AND c.id IS NULL
    `, [eventId]);

    // Get available templates count
    const [templatesCount] = await db.execute(`
      SELECT COUNT(*) as template_count
      FROM certificate_templates_multi
      WHERE event_id = ?
    `, [eventId]);

    // Get certificates sent count
    const [sentCertificates] = await db.execute(`
      SELECT COUNT(DISTINCT c.id) as sent_count
      FROM certificates c
      JOIN participants p ON c.participant_id = p.id
      JOIN tickets t ON p.ticket_id = t.id
      WHERE t.event_id = ? AND c.sent = TRUE
    `, [eventId]);

    const total = (totalParticipants as any[])[0]?.total || 0;
    const withCerts = (participantsWithCerts as any[])[0]?.with_certificates || 0;
    const withoutCerts = (participantsWithoutCerts as any[])[0]?.without_certificates || 0;
    const templates = (templatesCount as any[])[0]?.template_count || 0;
    const sent = (sentCertificates as any[])[0]?.sent_count || 0;

    return NextResponse.json({
      success: true,
      stats: {
        total_participants: total,
        participants_with_certificates: withCerts,
        participants_without_certificates: withoutCerts,
        available_templates: templates,
        certificates_sent: sent,
        generation_progress: total > 0 ? Math.round((withCerts / total) * 100) : 0,
        can_generate_all: withoutCerts > 0 && templates > 0
      }
    });

  } catch (error) {
    console.error('Error fetching certificate stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch certificate statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}