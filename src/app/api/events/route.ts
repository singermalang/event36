import { NextRequest, NextResponse } from 'next/server';
import db, { logSystemEvent } from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await db.execute(`
      SELECT 
        e.*,
        COUNT(t.id) as total_tickets,
        COUNT(CASE WHEN t.is_verified = TRUE THEN 1 END) as verified_tickets,
        COUNT(CASE WHEN t.is_verified = FALSE THEN 1 END) as available_tickets
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `);

    return NextResponse.json({ events: rows });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, type, location, description, start_time, end_time, quota } = body;

    // Validate required fields
    if (!name || !slug || !type || !location || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const [existingRows] = await db.execute(
      'SELECT id FROM events WHERE slug = ?',
      [slug]
    );

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return NextResponse.json(
        { error: 'Event slug already exists' },
        { status: 400 }
      );
    }

    // Insert new event
    const [result] = await db.execute(
      'INSERT INTO events (name, slug, type, location, description, start_time, end_time, quota, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [name, slug, type, location, description, start_time, end_time, quota || 0]
    );

    const insertResult = result as any;
    const eventId = insertResult.insertId;

    // Log the event creation
    await logSystemEvent('event_created', `New event created: ${name}`, {
      eventId,
      name,
      slug,
      type,
      location,
      quota
    });

    return NextResponse.json({
      success: true,
      message: 'Event created successfully',
      eventId
    });

  } catch (error) {
    console.error('Error creating event:', error);
    await logSystemEvent('event_creation_error', 'Failed to create event', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}