import { NextRequest, NextResponse } from 'next/server';
import db, { logSystemEvent } from '@/lib/db';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = parseInt(params.id);
    const body = await request.json();
    const { count = 10, prefix = 'TICKET' } = body;

    // Validate count
    if (count < 1 || count > 1000) {
      return NextResponse.json(
        { error: 'Count must be between 1 and 1000' },
        { status: 400 }
      );
    }

    // Get event details
    const [eventRows] = await db.execute(
      'SELECT * FROM events WHERE id = ?',
      [eventId]
    );

    if (!Array.isArray(eventRows) || eventRows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventRows[0] as any;

    // Ensure directories exist
    const ticketsDir = path.join(process.cwd(), 'public', 'tickets');
    const generatedTicketsDir = path.join(process.cwd(), 'public', 'generated-tickets');
    
    if (!fs.existsSync(ticketsDir)) {
      fs.mkdirSync(ticketsDir, { recursive: true });
    }
    if (!fs.existsSync(generatedTicketsDir)) {
      fs.mkdirSync(generatedTicketsDir, { recursive: true });
    }

    const tickets = [];
    const zip = new JSZip();

    // Generate tickets
    for (let i = 1; i <= count; i++) {
      const token = `${prefix}${eventId}${String(i).padStart(3, '0')}${Date.now().toString().slice(-4)}`;
      
      // Generate QR code
      const qrCodeBuffer = await QRCode.toBuffer(token, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Generate barcode
      const canvas = createCanvas(300, 100);
      JsBarcode(canvas, token, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        textMargin: 5
      });
      const barcodeBuffer = canvas.toBuffer();

      // Save QR code and barcode files
      const qrFilename = `qr_${token}.png`;
      const barcodeFilename = `barcode_${token}.png`;
      const qrPath = path.join(ticketsDir, qrFilename);
      const barcodePath = path.join(ticketsDir, barcodeFilename);

      fs.writeFileSync(qrPath, qrCodeBuffer);
      fs.writeFileSync(barcodePath, barcodeBuffer);

      // Add to zip
      zip.file(`qr_codes/${qrFilename}`, qrCodeBuffer);
      zip.file(`barcodes/${barcodeFilename}`, barcodeBuffer);

      // Insert ticket into database
      await db.execute(
        'INSERT INTO tickets (event_id, token, qr_code_url, barcode_url, is_verified, created_at) VALUES (?, ?, ?, ?, FALSE, NOW())',
        [eventId, token, `/tickets/${qrFilename}`, `/tickets/${barcodeFilename}`]
      );

      tickets.push({
        token,
        qrCodeUrl: `/tickets/${qrFilename}`,
        barcodeUrl: `/tickets/${barcodeFilename}`
      });
    }

    // Create CSV file with ticket data
    const csvContent = [
      'Token,QR Code URL,Barcode URL,Event Name,Generated At',
      ...tickets.map(ticket => 
        `${ticket.token},${ticket.qrCodeUrl},${ticket.barcodeUrl},"${event.name}","${new Date().toISOString()}"`
      )
    ].join('\n');

    zip.file('tickets.csv', csvContent);

    // Generate zip file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipFilename = `tickets_${event.slug}_${Date.now()}.zip`;
    const zipPath = path.join(generatedTicketsDir, zipFilename);
    
    fs.writeFileSync(zipPath, zipBuffer);

    // Save generation record
    await db.execute(
      'INSERT INTO generated_tickets (event_id, file_path, generated_at, generated_by, ticket_count) VALUES (?, ?, NOW(), ?, ?)',
      [eventId, `/generated-tickets/${zipFilename}`, 'system', count]
    );

    // Log the generation
    await logSystemEvent('tickets_generated', `Generated ${count} offline tickets for event ${event.name}`, {
      eventId,
      eventName: event.name,
      ticketCount: count,
      zipFile: zipFilename
    });

    return NextResponse.json({
      success: true,
      message: `Successfully generated ${count} tickets`,
      tickets,
      zipFile: `/generated-tickets/${zipFilename}`,
      downloadUrl: `/api/events/${eventId}/generated-tickets/download-zip?file=${zipFilename}`
    });

  } catch (error) {
    console.error('Error generating offline tickets:', error);
    await logSystemEvent('tickets_generation_error', 'Failed to generate offline tickets', { 
      eventId: params.id, 
      error: String(error) 
    });
    return NextResponse.json(
      { error: 'Failed to generate tickets' },
      { status: 500 }
    );
  }
}