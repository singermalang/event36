import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { writeFile, mkdir, access, unlink } from 'fs/promises'
import db from '@/lib/db'
import fs from 'fs'

// GET: fetch all 6 templates for an event
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [rows] = await db.execute(
      'SELECT template_index, template_path, template_fields FROM certificate_templates_multi WHERE event_id = ? ORDER BY template_index ASC',
      [params.id]
    );
    const templates = (rows as any[]).map(t => ({
      templateIndex: t.template_index,
      templateUrl: t.template_path,
      fields: typeof t.template_fields === 'string' ? JSON.parse(t.template_fields || '[]') : (t.template_fields || []),
      templateSize: { width: 842, height: 595 }, // default, will be updated below
    }))
    // Get image sizes for each template
    for (const t of templates) {
      if (t.templateUrl) {
        const imagePath = path.join(process.cwd(), 'public', t.templateUrl)
        let templateSize = { width: 842, height: 595 }
        try {
          const sharp = (await import('sharp')).default
          const metadata = await sharp(imagePath).metadata()
          templateSize = { width: metadata.width || 842, height: metadata.height || 595 }
        } catch {}
        t.templateSize = templateSize
      }
    }
    return NextResponse.json({ templates: templates || [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

// POST: save/update templates in bulk (JSON array)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const templates = body.templates;
    if (!Array.isArray(templates)) {
      return NextResponse.json({ error: 'Invalid templates data: not an array' }, { status: 400 });
    }
    for (const t of templates) {
      // Only allow valid file path (not base64)
      if (!t.image || typeof t.image !== 'string' || !t.image.startsWith('/certificates/')) {
        return NextResponse.json({ error: 'Invalid image path. Please upload image first.' }, { status: 400 });
      }
      if (!Array.isArray(t.elements)) {
        return NextResponse.json({ error: 'Invalid elements format. Must be an array.' }, { status: 400 });
      }
      await db.execute(
        `INSERT INTO certificate_templates_multi (event_id, template_index, template_path, template_fields)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE template_path = VALUES(template_path), template_fields = VALUES(template_fields)`,
        [
          params.id,
          t.template_index,
          t.image, // Should be a relative path or URL
          JSON.stringify(t.elements)
        ]
      );
    }
    return NextResponse.json({ message: 'Templates saved' });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save templates: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}

// DELETE: delete a template by index for an event
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { templateIndex } = await request.json();
    if (typeof templateIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid template index' }, { status: 400 });
    }
    // Get the template to delete
    const [rows] = await db.execute(
      'SELECT template_path FROM certificate_templates_multi WHERE event_id = ? AND template_index = ?',
      [params.id, templateIndex]
    );
    const templates = rows as any[];
    if (templates.length > 0 && templates[0].template_path) {
      // Delete the image file if it exists
      const imagePath = path.join(process.cwd(), 'public', templates[0].template_path);
      try {
        await unlink(imagePath);
      } catch (e) {
        // Ignore file not found
      }
    }
    // Delete the DB row
    await db.execute(
      'DELETE FROM certificate_templates_multi WHERE event_id = ? AND template_index = ?',
      [params.id, templateIndex]
    );
    return NextResponse.json({ message: 'Template deleted' });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}