import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateCertificateFromTemplate } from '@/lib/certificate-generator';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const certificateId = parseInt(params.id);

    // Get certificate and participant data
    const [certificateRows] = await db.execute(`
      SELECT c.*, p.name, p.email, e.name as event_name, e.start_time, e.location
      FROM certificates c
      JOIN participants p ON c.participant_id = p.id
      JOIN tickets t ON p.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      WHERE c.id = ?
    `, [certificateId]);

    if (!Array.isArray(certificateRows) || certificateRows.length === 0) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    const certificate = certificateRows[0] as any;

    // Get template for the event
    const [templateRows] = await db.execute(`
      SELECT template_path FROM certificate_templates 
      WHERE event_id = (
        SELECT e.id FROM events e
        JOIN tickets t ON e.id = t.event_id
        JOIN participants p ON t.id = p.ticket_id
        WHERE p.id = ?
      )
      LIMIT 1
    `, [certificate.participant_id]);

    let templatePath = '/templates/default_certificate.json';
    if (Array.isArray(templateRows) && templateRows.length > 0) {
      templatePath = (templateRows[0] as any).template_path;
    }

    // Prepare certificate data
    const certificateData = {
      participantName: certificate.name,
      eventName: certificate.event_name,
      eventDate: new Date(certificate.start_time).toLocaleDateString(),
      eventLocation: certificate.location
    };

    // Generate new certificate
    const outputPath = `/public/certificates/cert_${certificate.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const fullOutputPath = process.cwd() + outputPath;

    await generateCertificateFromTemplate(
      process.cwd() + templatePath,
      certificateData,
      fullOutputPath
    );

    // Update certificate path in database
    await db.execute(
      'UPDATE certificates SET path = ?, created_at = NOW() WHERE id = ?',
      [outputPath, certificateId]
    );

    return NextResponse.json({
      success: true,
      message: 'Certificate regenerated successfully',
      path: outputPath
    });

  } catch (error) {
    console.error('Error regenerating certificate:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate certificate' },
      { status: 500 }
    );
  }
}