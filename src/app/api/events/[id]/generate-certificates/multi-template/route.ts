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

    // Get certificate templates for this event
    const [templates] = await db.execute(`
      SELECT template_index, template_path, template_fields, template_size
      FROM certificate_templates_multi 
      WHERE event_id = ? 
      ORDER BY template_index ASC
    `, [eventId]);

    // Get participants with their certificate status
    const [participants] = await db.execute(`
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
      ORDER BY p.registered_at ASC
    `, [eventId]);

    return NextResponse.json({
      success: true,
      templates: templates || [],
      participants: participants || []
    });

  } catch (error) {
    console.error('Error fetching multi-template data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}