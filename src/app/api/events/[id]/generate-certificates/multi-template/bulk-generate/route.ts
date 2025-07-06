import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateCertificateFromTemplate } from '@/lib/certificate-generator';
import path from 'path';
import fs from 'fs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = parseInt(params.id);
    
    if (isNaN(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    // Get all participants for this event who don't have certificates yet
    const [participants] = await db.execute(`
      SELECT DISTINCT 
        p.id as participant_id,
        p.name,
        p.email,
        p.phone,
        p.address,
        p.registered_at,
        t.token,
        e.name as event_name,
        e.type as event_type,
        e.start_time,
        e.end_time,
        e.location
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      LEFT JOIN certificates c ON p.id = c.participant_id
      WHERE e.id = ? AND t.is_verified = TRUE AND c.id IS NULL
      ORDER BY p.registered_at ASC
    `, [eventId]);

    if (!Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ 
        error: 'No participants found or all certificates already generated' 
      }, { status: 404 });
    }

    // Get available certificate templates for this event
    const [templates] = await db.execute(`
      SELECT template_index, template_path, template_fields, template_size
      FROM certificate_templates_multi 
      WHERE event_id = ? 
      ORDER BY template_index ASC
    `, [eventId]);

    if (!Array.isArray(templates) || templates.length === 0) {
      return NextResponse.json({ 
        error: 'No certificate templates found for this event' 
      }, { status: 404 });
    }

    const results = [];
    const errors = [];
    let successCount = 0;

    // Ensure certificates directory exists
    const certificatesDir = path.join(process.cwd(), 'public', 'certificates');
    if (!fs.existsSync(certificatesDir)) {
      fs.mkdirSync(certificatesDir, { recursive: true });
    }

    // Process each participant
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i] as any;
      
      try {
        // Select template based on participant index (round-robin distribution)
        const templateIndex = i % templates.length;
        const selectedTemplate = templates[templateIndex] as any;
        
        // Prepare certificate data
        const certificateData = {
          participant_name: participant.name,
          event_name: participant.event_name,
          event_type: participant.event_type,
          event_location: participant.location,
          completion_date: new Date().toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          issue_date: new Date().toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          participant_email: participant.email,
          participant_phone: participant.phone,
          participant_address: participant.address,
          ticket_token: participant.token
        };

        // Generate certificate filename
        const sanitizedName = participant.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const sanitizedEvent = participant.event_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const timestamp = Date.now();
        const filename = `cert_${sanitizedName}_${sanitizedEvent}_${timestamp}.pdf`;
        const certificatePath = `/certificates/${filename}`;
        const fullPath = path.join(certificatesDir, filename);

        // Generate the certificate
        await generateCertificateFromTemplate(
          selectedTemplate.template_path,
          certificateData,
          fullPath,
          selectedTemplate.template_size ? JSON.parse(selectedTemplate.template_size) : { width: 842, height: 595 }
        );

        // Save certificate record to database
        const [insertResult] = await db.execute(`
          INSERT INTO certificates (participant_id, template_id, path, sent, created_at)
          VALUES (?, ?, ?, FALSE, NOW())
        `, [participant.participant_id, selectedTemplate.template_index, certificatePath]);

        results.push({
          participant_id: participant.participant_id,
          participant_name: participant.name,
          certificate_path: certificatePath,
          template_used: selectedTemplate.template_index,
          status: 'success'
        });

        successCount++;

      } catch (error) {
        console.error(`Error generating certificate for participant ${participant.participant_id}:`, error);
        
        errors.push({
          participant_id: participant.participant_id,
          participant_name: participant.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        results.push({
          participant_id: participant.participant_id,
          participant_name: participant.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log the bulk generation activity
    await db.execute(`
      INSERT INTO logs (type, message, meta, created_at)
      VALUES ('certificate_bulk_generation', ?, ?, NOW())
    `, [
      `Bulk certificate generation completed for event ${eventId}`,
      JSON.stringify({
        event_id: eventId,
        total_participants: participants.length,
        successful_generations: successCount,
        failed_generations: errors.length,
        templates_used: templates.length
      })
    ]);

    return NextResponse.json({
      success: true,
      message: `Bulk certificate generation completed`,
      summary: {
        total_participants: participants.length,
        successful_generations: successCount,
        failed_generations: errors.length,
        templates_available: templates.length
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Bulk certificate generation error:', error);
    
    // Log the error
    try {
      await db.execute(`
        INSERT INTO logs (type, message, meta, created_at)
        VALUES ('certificate_bulk_generation_error', ?, ?, NOW())
      `, [
        `Bulk certificate generation failed for event ${params.id}`,
        JSON.stringify({
          event_id: params.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
      ]);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to generate certificates',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}