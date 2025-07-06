import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateCertificateFromTemplate } from '@/lib/certificate-generator';
import fs from 'fs';
import path from 'path';

export async function POST(
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

    const event = eventRows[0] as any;

    // Get all participants for this event who don't have certificates yet
    const [participantRows] = await db.execute(`
      SELECT DISTINCT p.id, p.name, p.email, t.token
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      WHERE t.event_id = ? AND t.is_verified = TRUE
      AND p.id NOT IN (
        SELECT participant_id FROM certificates WHERE participant_id IS NOT NULL
      )
    `, [eventId]);

    if (!Array.isArray(participantRows) || participantRows.length === 0) {
      return NextResponse.json({ 
        error: 'No participants found without certificates' 
      }, { status: 404 });
    }

    const participants = participantRows as any[];

    // Get available templates for this event
    const [templateRows] = await db.execute(
      'SELECT * FROM certificate_templates_multi WHERE event_id = ? ORDER BY template_index',
      [eventId]
    );

    if (!Array.isArray(templateRows) || templateRows.length === 0) {
      return NextResponse.json({ 
        error: 'No certificate templates found for this event' 
      }, { status: 404 });
    }

    const templates = templateRows as any[];

    // Ensure certificates directory exists
    const certificatesDir = path.join(process.cwd(), 'public', 'certificates');
    if (!fs.existsSync(certificatesDir)) {
      fs.mkdirSync(certificatesDir, { recursive: true });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Generate certificates for all participants
    for (let i = 0; i < participants.length; i++) {
      try {
        const participant = participants[i];
        
        // Assign template using round-robin
        const templateIndex = i % templates.length;
        const template = templates[templateIndex];

        // Prepare certificate data
        const certificateData = {
          participantName: participant.name,
          eventName: event.name,
          eventDate: new Date(event.start_time).toLocaleDateString(),
          eventLocation: event.location,
          completionDate: new Date().toLocaleDateString()
        };

        // Generate certificate filename
        const filename = `cert_${participant.name.replace(/\s+/g, '_')}_${event.slug}_${Date.now()}_${i}.pdf`;
        const outputPath = path.join(certificatesDir, filename);
        const relativePath = `/certificates/${filename}`;

        // Generate certificate
        await generateCertificateFromTemplate(
          path.join(process.cwd(), 'public', template.template_path),
          certificateData,
          outputPath
        );

        // Save certificate record to database
        await db.execute(
          'INSERT INTO certificates (participant_id, template_id, path, sent, created_at) VALUES (?, ?, ?, FALSE, NOW())',
          [participant.id, template.id, relativePath]
        );

        successCount++;
        
        // Log progress
        console.log(`Generated certificate ${i + 1}/${participants.length} for ${participant.name}`);

      } catch (error) {
        console.error(`Error generating certificate for participant ${participants[i].name}:`, error);
        errorCount++;
        errors.push(`Failed to generate certificate for ${participants[i].name}: ${error}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk certificate generation completed`,
      stats: {
        total: participants.length,
        success: successCount,
        errors: errorCount,
        errorDetails: errors
      }
    });

  } catch (error) {
    console.error('Error in bulk certificate generation:', error);
    return NextResponse.json(
      { error: 'Failed to generate certificates', details: error },
      { status: 500 }
    );
  }
}