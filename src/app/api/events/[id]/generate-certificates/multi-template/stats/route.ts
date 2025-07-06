import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = parseInt(params.id);

    // Get total participants for this event
    const [totalParticipantsRows] = await db.execute(`
      SELECT COUNT(DISTINCT p.id) as total
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      WHERE t.event_id = ? AND t.is_verified = TRUE
    `, [eventId]);

    const totalParticipants = Array.isArray(totalParticipantsRows) && totalParticipantsRows.length > 0 
      ? (totalParticipantsRows[0] as any).total 
      : 0;

    // Get participants with certificates
    const [withCertificatesRows] = await db.execute(`
      SELECT COUNT(DISTINCT p.id) as with_certificates
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      JOIN certificates c ON p.id = c.participant_id
      WHERE t.event_id = ? AND t.is_verified = TRUE
    `, [eventId]);

    const withCertificates = Array.isArray(withCertificatesRows) && withCertificatesRows.length > 0 
      ? (withCertificatesRows[0] as any).with_certificates 
      : 0;

    // Get participants without certificates
    const [withoutCertificatesRows] = await db.execute(`
      SELECT COUNT(DISTINCT p.id) as without_certificates
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      WHERE t.event_id = ? AND t.is_verified = TRUE
      AND p.id NOT IN (
        SELECT participant_id FROM certificates WHERE participant_id IS NOT NULL
      )
    `, [eventId]);

    const withoutCertificates = Array.isArray(withoutCertificatesRows) && withoutCertificatesRows.length > 0 
      ? (withoutCertificatesRows[0] as any).without_certificates 
      : 0;

    // Get available templates count
    const [templatesRows] = await db.execute(
      'SELECT COUNT(*) as template_count FROM certificate_templates_multi WHERE event_id = ?',
      [eventId]
    );

    const templateCount = Array.isArray(templatesRows) && templatesRows.length > 0 
      ? (templatesRows[0] as any).template_count 
      : 0;

    // Calculate progress percentage
    const progressPercentage = totalParticipants > 0 
      ? Math.round((withCertificates / totalParticipants) * 100) 
      : 0;

    // Check if generation is possible
    const canGenerate = templateCount > 0 && withoutCertificates > 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalParticipants,
        withCertificates,
        withoutCertificates,
        templateCount,
        progressPercentage,
        canGenerate
      }
    });

  } catch (error) {
    console.error('Error fetching certificate statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}