import { createCanvas, loadImage, registerFont } from 'canvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export interface CertificateData {
  participantName: string;
  eventName: string;
  eventDate: string;
  eventLocation?: string;
  completionDate?: string;
  hours?: string;
  instructor?: string;
  projectCompleted?: string;
}

export interface TemplateConfig {
  width: number;
  height: number;
  backgroundColor: string;
  textFields: {
    participantName: {
      x: number;
      y: number;
      fontSize: number;
      color: string;
      fontFamily: string;
      align: 'left' | 'center' | 'right';
    };
    eventName: {
      x: number;
      y: number;
      fontSize: number;
      color: string;
      fontFamily: string;
      align: 'left' | 'center' | 'right';
    };
    eventDate: {
      x: number;
      y: number;
      fontSize: number;
      color: string;
      fontFamily: string;
      align: 'left' | 'center' | 'right';
    };
    [key: string]: any;
  };
}

// Default template configuration
const defaultTemplate: TemplateConfig = {
  width: 1200,
  height: 800,
  backgroundColor: '#ffffff',
  textFields: {
    participantName: {
      x: 600,
      y: 400,
      fontSize: 48,
      color: '#2c3e50',
      fontFamily: 'Arial',
      align: 'center'
    },
    eventName: {
      x: 600,
      y: 300,
      fontSize: 32,
      color: '#34495e',
      fontFamily: 'Arial',
      align: 'center'
    },
    eventDate: {
      x: 600,
      y: 200,
      fontSize: 24,
      color: '#7f8c8d',
      fontFamily: 'Arial',
      align: 'center'
    }
  }
};

export async function generateCertificateFromTemplate(
  templatePath: string,
  data: CertificateData,
  outputPath: string
): Promise<string> {
  try {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Check if template exists
    let template = defaultTemplate;
    if (fs.existsSync(templatePath)) {
      try {
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        template = JSON.parse(templateContent);
      } catch (error) {
        console.warn('Failed to parse template, using default:', error);
      }
    }

    // Create canvas
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');

    // Set background
    ctx.fillStyle = template.backgroundColor;
    ctx.fillRect(0, 0, template.width, template.height);

    // Add border
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, template.width - 40, template.height - 40);

    // Add decorative elements
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, template.width - 80, template.height - 80);

    // Add title
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CERTIFICATE OF COMPLETION', template.width / 2, 120);

    // Add subtitle
    ctx.font = '32px Arial';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText('This is to certify that', template.width / 2, 180);

    // Add participant name
    ctx.font = 'bold 56px Arial';
    ctx.fillStyle = '#2c3e50';
    ctx.fillText(data.participantName, template.width / 2, 280);

    // Add completion text
    ctx.font = '28px Arial';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText('has successfully completed', template.width / 2, 340);

    // Add event name
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#3498db';
    ctx.fillText(data.eventName, template.width / 2, 420);

    // Add date
    ctx.font = '24px Arial';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText(`Completed on: ${data.eventDate}`, template.width / 2, 500);

    if (data.eventLocation) {
      ctx.fillText(`Location: ${data.eventLocation}`, template.width / 2, 540);
    }

    // Add signature line
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(template.width / 2 - 150, 650);
    ctx.lineTo(template.width / 2 + 150, 650);
    ctx.stroke();

    ctx.font = '20px Arial';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText('Authorized Signature', template.width / 2, 680);

    // Convert to PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([template.width, template.height]);

    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');
    const pngImage = await pdfDoc.embedPng(buffer);

    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: template.width,
      height: template.height,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);

    console.log(`Certificate generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
}

export async function generateCertificateWithTemplate(
  templatePath: string,
  data: CertificateData,
  outputPath: string
): Promise<string> {
  return generateCertificateFromTemplate(templatePath, data, outputPath);
}

export async function generateCertificatePreview(
  templatePath: string,
  data: CertificateData
): Promise<Buffer> {
  try {
    // Check if template exists
    let template = defaultTemplate;
    if (fs.existsSync(templatePath)) {
      try {
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        template = JSON.parse(templateContent);
      } catch (error) {
        console.warn('Failed to parse template, using default:', error);
      }
    }

    // Create canvas for preview (smaller size)
    const previewWidth = 600;
    const previewHeight = 400;
    const canvas = createCanvas(previewWidth, previewHeight);
    const ctx = canvas.getContext('2d');

    // Set background
    ctx.fillStyle = template.backgroundColor;
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    // Add border
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, previewWidth - 20, previewHeight - 20);

    // Add title
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CERTIFICATE OF COMPLETION', previewWidth / 2, 50);

    // Add participant name
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#2c3e50';
    ctx.fillText(data.participantName, previewWidth / 2, 120);

    // Add event name
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#3498db';
    ctx.fillText(data.eventName, previewWidth / 2, 160);

    // Add date
    ctx.font = '12px Arial';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText(`Completed on: ${data.eventDate}`, previewWidth / 2, 200);

    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Error generating certificate preview:', error);
    throw error;
  }
}

export async function createCertificateTemplate(
  templatePath: string,
  config: TemplateConfig
): Promise<void> {
  try {
    // Ensure template directory exists
    const templateDir = path.dirname(templatePath);
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    // Save template configuration
    fs.writeFileSync(templatePath, JSON.stringify(config, null, 2));
    console.log(`Template created: ${templatePath}`);
  } catch (error) {
    console.error('Error creating certificate template:', error);
    throw error;
  }
}