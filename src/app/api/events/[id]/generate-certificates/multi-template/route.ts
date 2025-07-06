import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = parseInt(params.id);

    // Get event details
    const [eventRows] = await db.execute(
      'SELECT * FROM events WHERE id = ?',
      [eventId]
    );

    if (!Array.isArray(eventRows) || eventRows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventRows[0];

    // Get participants with their certificate status
    const [participantRows] = await db.execute(`
      SELECT 
        p.id,
        p.name,
        p.email,
        p.phone,
        p.address,
        p.registered_at,
        t.token,
        t.is_verified,
        c.id as certificate_id,
        c.path as certificate_path,
        c.sent as certificate_sent,
        c.created_at as certificate_created_at
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      LEFT JOIN certificates c ON p.id = c.participant_id
      WHERE t.event_id = ? AND t.is_verified = TRUE
      ORDER BY p.registered_at DESC
    `, [eventId]);

    const participants = Array.isArray(participantRows) ? participantRows : [];

    // Get available templates
    const [templateRows] = await db.execute(
      'SELECT * FROM certificate_templates_multi WHERE event_id = ? ORDER BY template_index',
      [eventId]
    );

    const templates = Array.isArray(templateRows) ? templateRows : [];

    return NextResponse.json({
      success: true,
      event,
      participants,
      templates,
      stats: {
        totalParticipants: participants.length,
        withCertificates: participants.filter((p: any) => p.certificate_id).length,
        withoutCertificates: participants.filter((p: any) => !p.certificate_id).length,
        templateCount: templates.length
      }
    });

  } catch (error) {
    console.error('Error fetching multi-template data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}