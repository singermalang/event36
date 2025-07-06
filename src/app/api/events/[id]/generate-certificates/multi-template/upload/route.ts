import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, access, unlink } from 'fs/promises';
import path from 'path';
import db from '@/lib/db';
import fs from 'fs';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const formData = await request.formData();
    const file = formData.get('templateImage') as File | null;
    const templateIndex = formData.get('templateIndex');
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (!templateIndex) {
      return NextResponse.json({ error: 'templateIndex is required' }, { status: 400 });
    }
    const allowedTypes = ['image/png', 'image/jpeg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only PNG and JPEG allowed.' }, { status: 400 });
    }
    // Pastikan folder certificates/templates ada
    const certDir = path.join(process.cwd(), 'public', 'certificates', 'templates');
    try { await access(certDir); } catch { await mkdir(certDir, { recursive: true }); }
    // Nama file unik
    const eventId = params.id;
    const timestamp = Date.now();
    const ext = path.extname(file.name);
    const filename = `multi-template-event-${eventId}-idx-${templateIndex}-${timestamp}${ext}`;
    const filepath = path.join(certDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer, { mode: 0o644 });
    const templatePath = `/certificates/templates/${filename}`;
    // Cek apakah baris sudah ada
    const [oldTemplates] = await db.execute('SELECT id, template_path FROM certificate_templates_multi WHERE event_id = ? AND template_index = ?', [eventId, templateIndex]);
    if ((oldTemplates as any[]).length === 0) {
      // Insert jika belum ada
      await db.execute('INSERT INTO certificate_templates_multi (event_id, template_index, template_path, template_fields) VALUES (?, ?, ?, ?)', [eventId, templateIndex, templatePath, '[]']);
    } else {
      // Hapus gambar lama jika ada
      for (const row of oldTemplates as any[]) {
        if (row.template_path && row.template_path !== templatePath) {
          try { await unlink(path.join(process.cwd(), 'public', row.template_path)); } catch {}
        }
      }
      // Update DB (hanya path gambar, fields tidak diubah di sini)
      await db.execute('UPDATE certificate_templates_multi SET template_path = ? WHERE event_id = ? AND template_index = ?', [templatePath, eventId, templateIndex]);
    }
    return NextResponse.json({ message: 'Image uploaded', path: templatePath });
  } catch (error) {
    console.error('Error uploading multi-template image:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
} 