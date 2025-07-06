import { NextRequest, NextResponse } from 'next/server'
import formidable from 'formidable'
import path from 'path'
import db, { logSystemEvent } from '@/lib/db'
import fs from 'fs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('template') as File
    const eventId = formData.get('eventId') as string
    const templateIndex = formData.get('templateIndex') as string

    if (!file || !eventId || !templateIndex) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const originalName = file.name
    const extension = path.extname(originalName)
    const filename = `template_${eventId}_${templateIndex}_${timestamp}${extension}`
    const filePath = path.join(uploadsDir, filename)
    const relativePath = `/uploads/${filename}`

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    fs.writeFileSync(filePath, buffer)

    // Save template info to database
    await db.execute(`
      INSERT INTO certificate_templates_multi (event_id, template_index, template_path, template_fields, created_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
      template_path = VALUES(template_path),
      template_fields = VALUES(template_fields),
      created_at = NOW()
    `, [
      parseInt(eventId),
      parseInt(templateIndex),
      relativePath,
      JSON.stringify({})
    ])

    // Log the upload
    await logSystemEvent('template_upload', `Certificate template uploaded for event ${eventId}`, {
      eventId: parseInt(eventId),
      templateIndex: parseInt(templateIndex),
      filename,
      originalName,
      fileSize: buffer.length
    })

    return NextResponse.json({
      success: true,
      message: 'Template uploaded successfully',
      templatePath: relativePath,
      filename
    })

  } catch (error) {
    console.error('Error uploading template:', error)
    await logSystemEvent('template_upload_error', 'Failed to upload certificate template', { error: String(error) })
    return NextResponse.json(
      { error: 'Failed to upload template' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    // Get all templates for the event
    const [rows] = await db.execute(
      'SELECT * FROM certificate_templates_multi WHERE event_id = ? ORDER BY template_index',
      [parseInt(eventId)]
    )

    const templates = Array.isArray(rows) ? rows : []

    return NextResponse.json({
      success: true,
      templates
    })

  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const templateIndex = searchParams.get('templateIndex')

    if (!eventId || !templateIndex) {
      return NextResponse.json({ error: 'Event ID and template index are required' }, { status: 400 })
    }

    // Get template info before deletion
    const [rows] = await db.execute(
      'SELECT * FROM certificate_templates_multi WHERE event_id = ? AND template_index = ?',
      [parseInt(eventId), parseInt(templateIndex)]
    )

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const template = rows[0] as any

    // Delete file from filesystem
    const filePath = path.join(process.cwd(), 'public', template.template_path)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete from database
    await db.execute(
      'DELETE FROM certificate_templates_multi WHERE event_id = ? AND template_index = ?',
      [parseInt(eventId), parseInt(templateIndex)]
    )

    // Log the deletion
    await logSystemEvent('template_delete', `Certificate template deleted for event ${eventId}`, {
      eventId: parseInt(eventId),
      templateIndex: parseInt(templateIndex),
      templatePath: template.template_path
    })

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting template:', error)
    await logSystemEvent('template_delete_error', 'Failed to delete certificate template', { error: String(error) })
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}