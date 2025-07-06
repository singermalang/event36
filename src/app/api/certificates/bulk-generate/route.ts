import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { generateCertificate } from '@/lib/certificate'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { participantIds } = await request.json()

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json({ error: 'Participant IDs must be a non-empty array' }, { status: 400 })
    }

    let successCount = 0
    let failureCount = 0
    const results = []

    for (const participantId of participantIds) {
      try {
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
          throw new Error('Participant or event not found')
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
            throw new Error('No certificate template found for event')
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
        results.push({ participantId, status: 'success', path: certPath })
        successCount++
      } catch (error) {
        console.error(`Failed to generate certificate for participant ${participantId}:`, error)
        failureCount++
        results.push({ participantId, status: 'failed', reason: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return NextResponse.json({
      message: 'Bulk generation process completed.',
      successCount,
      failureCount,
      results,
    })
  } catch (error) {
    console.error('Bulk Generate Certificate Error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
} 