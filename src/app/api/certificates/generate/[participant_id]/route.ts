import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { generateCertificate } from '@/lib/certificate'
import path from 'path'

export async function POST(request: NextRequest, { params }: { params: { participant_id: string } }) {
  try {
    const participantId = params.participant_id
    // Fetch participant, event, and template data
    const [rows] = await db.execute(`
      SELECT p.id as participantId, p.name as participantName, e.id as eventId, e.name as eventName, c.certificate_number, c.template_path
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      LEFT JOIN certificates c ON c.participant_id = p.id
      WHERE p.id = ?
      LIMIT 1
    `, [participantId])
    const data = (rows as any[])[0]
    if (!data) {
      return NextResponse.json({ error: 'Participant or event not found' }, { status: 404 })
    }
    // If no certificate_number, generate a new one
    let certificateNumber = data.certificate_number
    if (!certificateNumber) {
      const now = new Date()
      const bulanRomawi = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
      const mmRomawi = bulanRomawi[now.getMonth() + 1]
      const yyyy = now.getFullYear()
      certificateNumber = `NOMOR : ${data.participantId}${data.eventId}/AUTO/${mmRomawi}/${yyyy}`
    }
    // Use default template if not present
    let templatePath = data.template_path
    if (!templatePath) {
      // Try to get latest template for the event
      const [templateRows] = await db.execute('SELECT template_path FROM certificate_templates WHERE event_id = ? ORDER BY created_at DESC LIMIT 1', [data.eventId])
      templatePath = (templateRows as any[])[0]?.template_path
      if (!templatePath) {
        return NextResponse.json({ error: 'No certificate template found for event' }, { status: 404 })
      }
      templatePath = path.join('public', templatePath)
    } else if (!templatePath.startsWith('public')) {
      templatePath = path.join('public', templatePath)
    }
    // Call generateCertificate with correct object
    const certPath = await generateCertificate({
      participantName: data.participantName,
      eventName: data.eventName,
      participantId: data.participantId,
      eventId: data.eventId,
      certificateNumber,
      templatePath
    })
    return NextResponse.json({ path: certPath })
  } catch (e) {
    console.error('Generate Certificate (single) Error:', e)
    let errorMessage = 'Unknown error'
    if (e instanceof Error) {
      errorMessage = e.message
    }
    // Customize status code based on error message
    if (errorMessage.includes('sudah ada')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }
    if (errorMessage.includes('Template')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 })
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
} 