'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Rnd } from 'react-rnd';
import toast from 'react-hot-toast';

interface Event {
  id: number;
  name: string;
  type: string;
  location: string;
  start_time: string;
  end_time: string;
}

interface Participant {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  token: string;
  registered_at: string;
  is_verified: number;
}

interface TextElement {
  id: string;
  type: 'participant_name' | 'event_name' | 'certificate_number' | 'date' | 'token';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  text: string;
}

interface Template {
  id: number;
  image: string;
  elements: TextElement[];
  templateSize: { width: number; height: number };
}

const FONT_FAMILIES = [
  'Helvetica', 'Times Roman', 'Courier'
];

const ELEMENT_TYPES = [
  { id: 'participant_name', label: 'Nama Peserta', defaultText: 'Nama Peserta' },
  { id: 'event_name', label: 'Nama Event', defaultText: 'Nama Event' },
  { id: 'certificate_number', label: 'Nomor Sertifikat', defaultText: 'Nomor Sertifikat' },
  { id: 'date', label: 'Tanggal', defaultText: 'Tanggal' },
  { id: 'token', label: 'Token', defaultText: 'Token' }
];

const CANVAS_WIDTH = 842;
const CANVAS_HEIGHT = 595;
const activeTemplateSize = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

// Helper untuk mapping fontFamily ke CSS fallback agar browser bisa render bold/miring
const getCssFontFamily = (fontFamily: string) => {
  if (fontFamily === 'Helvetica') return `'Helvetica Neue', Helvetica, Arial, sans-serif`;
  if (fontFamily === 'Times Roman') return `'Times New Roman', Times, serif`;
  if (fontFamily === 'Courier') return `'Courier New', Courier, monospace`;
  return fontFamily;
};

export default function GenerateMultiCertificatesPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<number>(0);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [sendingProgress, setSendingProgress] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchEventData();
    fetchParticipants();
    loadTemplates();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}`);
      if (response.ok) {
        const data = await response.json();
        setEvent(data);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Gagal memuat data event');
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await fetch(`/api/participants?event_id=${eventId}`);
      if (response.ok) {
        const data = await response.json();
        setParticipants(data.participants || data);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast.error('Gagal memuat data peserta');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template`);
      if (response.ok) {
        const data = await response.json();
        let loadedTemplates = [];
        if (data.templates && Array.isArray(data.templates)) {
          loadedTemplates = data.templates.map((t: any, idx: number) => ({
            id: t.templateIndex ?? idx + 1,
            image: t.templateUrl ? t.templateUrl : '',
            elements: Array.isArray(t.fields) ? t.fields : [],
            templateSize: t.templateSize || { width: 842, height: 595 }
          }));
        }
        // Jika kosong, tambahkan 1 template default
        if (loadedTemplates.length === 0) {
          loadedTemplates = [{
            id: 1,
            image: '',
            elements: [],
            templateSize: { width: 842, height: 595 }
          }];
        }
        setTemplates(loadedTemplates);
      } else {
        setTemplates([{
          id: 1,
          image: '',
          elements: [],
          templateSize: { width: 842, height: 595 }
        }]);
      }
    } catch (error) {
      setTemplates([{
        id: 1,
        image: '',
        elements: [],
        templateSize: { width: 842, height: 595 }
      }]);
    }
  };

  const addTemplate = async () => {
    if (templates.length >= 6) {
      toast.error('Maksimal 6 template');
      return;
    }
    setIsSaving(true);
    const newTemplate: Template = {
      id: templates.length + 1,
      image: '',
      elements: [],
      templateSize: { width: 842, height: 595 }
    };
    const newTemplates = [...templates, newTemplate];
    setTemplates(newTemplates);
    setActiveTemplate(newTemplates.length - 1);
    await saveTemplates(newTemplates);
    setIsSaving(false);
  };

  const removeTemplate = async (index: number) => {
    if (templates.length <= 1) {
      toast.error('Minimal harus ada 1 template');
      return;
    }
    if (!window.confirm('Yakin ingin menghapus template ini?')) return;
    setIsDeleting(true);
    try {
      const templateId = templates[index].id;
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateIndex: templateId })
      });
      if (!response.ok) throw new Error('Failed to delete template');
      toast.success('Template berhasil dihapus');
      await loadTemplates();
      setActiveTemplate(Math.max(0, index - 1));
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Gagal menghapus template');
    }
    setIsDeleting(false);
  };

  const getActiveTemplateSize = () => {
    const t = templates[activeTemplate];
    if (t && t.image && t.templateSize && t.templateSize.width && t.templateSize.height) {
      return { width: t.templateSize.width, height: t.templateSize.height };
    }
    return { width: 842, height: 595 };
  };

  // Upload gambar template high-res, simpan ukuran asli
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsUploading(true);
    const file = event.target.files?.[0];
    if (!file) { setIsUploading(false); return; }
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('File harus PNG atau JPEG');
      setIsUploading(false);
      return;
    }
    if (!templates[activeTemplate] || typeof templates[activeTemplate].id === 'undefined') {
      toast.error('Template belum dipilih atau belum dibuat.');
      setIsUploading(false);
      return;
    }
    // Deteksi ukuran gambar asli
    const img = new window.Image();
    img.onload = async () => {
      try {
        const formData = new FormData();
        formData.append('templateImage', file);
        formData.append('templateIndex', String(templates[activeTemplate].id));
        formData.append('templateWidth', String(img.width));
        formData.append('templateHeight', String(img.height));
        const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/upload`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to upload image');
        }
        const data = await response.json();
        const newTemplates = [...templates];
        newTemplates[activeTemplate].image = data.path;
        newTemplates[activeTemplate].templateSize = { width: img.width, height: img.height };
        setTemplates(newTemplates);
        await saveTemplates(newTemplates);
        await loadTemplates();
        toast.success('Gambar template berhasil diupload (high-res)');
      } catch (error: any) {
        console.error('Error uploading image:', error);
        toast.error('Gagal upload gambar template: ' + (error?.message || error));
      }
      setIsUploading(false);
    };
    img.onerror = () => {
      toast.error('Gagal membaca gambar.');
      setIsUploading(false);
    };
    img.src = URL.createObjectURL(file);
  };

  const addTextElement = async (type: string) => {
    const elementType = ELEMENT_TYPES.find(t => t.id === type);
    if (!elementType) return;
    const newElement: TextElement = {
      id: `${type}_${Date.now()}`,
      type: type as any,
      x: 100,
      y: 100,
      width: 200,
      height: 40,
      fontSize: 24,
      fontFamily: 'Helvetica',
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#222222',
      text: elementType.defaultText
    };
    const newTemplates = [...templates];
    newTemplates[activeTemplate].elements.push(newElement);
    setTemplates(newTemplates);
    setSelectedElement(newElement.id);
    await saveTemplates(newTemplates);
    await loadTemplates();
  };

  const updateElement = async (elementId: string, updates: Partial<TextElement>) => {
    const newTemplates = [...templates];
    const elementIndex = newTemplates[activeTemplate].elements.findIndex(el => el.id === elementId);
    if (elementIndex !== -1) {
      newTemplates[activeTemplate].elements[elementIndex] = {
        ...newTemplates[activeTemplate].elements[elementIndex],
        ...updates
      };
      setTemplates(newTemplates);
      await saveTemplates(newTemplates);
      await loadTemplates();
    }
  };

  const removeElement = async (elementId: string) => {
    const newTemplates = [...templates];
    newTemplates[activeTemplate].elements = newTemplates[activeTemplate].elements.filter(el => el.id !== elementId);
    setTemplates(newTemplates);
    setSelectedElement(null);
    await saveTemplates(newTemplates);
    await loadTemplates();
  };

  // Helper to map templates for backend
  const typeToKey = {
    participant_name: 'name',
    event_name: 'event',
    certificate_number: 'number',
    date: 'date',
    token: 'token',
  };
  const mapTemplatesForBackend = (templatesArr: Template[]) =>
    templatesArr.map((t, idx) => ({
      template_index: idx + 1,
      image: t.image,
      templateSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      elements: t.elements.map(el => ({
        ...el,
        key: typeToKey[el.type] || el.type,
        bold: el.fontWeight === 'bold',
        italic: el.fontStyle === 'italic',
      }))
    }));

  const saveTemplates = async (templatesToSave?: Template[]) => {
    try {
      const mappedTemplates = mapTemplatesForBackend(templatesToSave || templates);
      // Validasi: semua image harus path hasil upload
      for (const t of mappedTemplates) {
        if (!t.image || typeof t.image !== 'string' || !t.image.startsWith('/certificates/')) {
          toast.error('Semua template harus sudah upload gambar (PNG/JPEG)');
          return;
        }
      }
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: mappedTemplates })
      });
      if (response.ok) {
        toast.success('Template berhasil disimpan');
        await loadTemplates();
      } else {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save templates');
      }
    } catch (error: any) {
      console.error('Error saving templates:', error);
      toast.error('Gagal menyimpan template: ' + (error?.message || error));
    }
  };

  const previewTemplate = async () => {
    if (!templates[activeTemplate].image || !templates[activeTemplate].image.startsWith('/certificates/')) {
      toast.error('Upload gambar template terlebih dahulu');
      return;
    }
    const verifiedParticipants = participants.filter((p: any) => p.is_verified === 1);
    if (!verifiedParticipants.length) {
      toast.error('Tidak ada peserta untuk preview');
      return;
    }
    try {
      await saveTemplates(); // Always save before preview
      await loadTemplates(); // Always reload before preview
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: verifiedParticipants[0].id,
          templateIndex: activeTemplate + 1
        })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate preview');
      }
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast.error('Gagal membuat preview: ' + (error?.message || error));
    }
  };

  const generateCertificates = async () => {
    if (templates.some(t => !t.image || !t.image.startsWith('/certificates/'))) {
      toast.error('Semua template harus memiliki gambar hasil upload');
      return;
    }
    const verifiedParticipants = participants.filter((p: any) => p.is_verified === 1);
    if (!verifiedParticipants.length) {
      toast.error('Tidak ada peserta terverifikasi');
      return;
    }
    setIsGenerating(true);
    setGenerationProgress(0);
    try {
      await saveTemplates(); // Always save before generate
      await loadTemplates(); // Always reload before generate
      const mappedTemplates = mapTemplatesForBackend(templates);
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/bulk-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: mappedTemplates })
      });
      if (response.ok) {
        // Monitor progress
        const checkProgress = setInterval(async () => {
          try {
            const progressResponse = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/stats`);
            if (progressResponse.ok) {
              const stats = await progressResponse.json();
              const progress = (stats.generated / stats.total) * 100;
              setGenerationProgress(progress);
              if (progress >= 100) {
                clearInterval(checkProgress);
                setIsGenerating(false);
                toast.success('Semua sertifikat berhasil digenerate');
                fetchParticipants(); // Refresh data
              }
            }
          } catch (error) {
            console.error('Error checking progress:', error);
          }
        }, 1000);
        // Cleanup after 10 minutes
        setTimeout(() => {
          clearInterval(checkProgress);
          setIsGenerating(false);
          toast.error('Generate sertifikat terlalu lama/gagal. Cek koneksi atau server.');
        }, 600000);
      } else {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate certificates');
      }
    } catch (error: any) {
      console.error('Error generating certificates:', error);
      toast.error('Gagal generate sertifikat: ' + (error?.message || error));
      setIsGenerating(false);
    }
  };

  const sendAllCertificates = async () => {
    const verifiedParticipants = participants.filter((p: any) => p.is_verified === 1);
    if (!verifiedParticipants.length) {
      toast.error('Tidak ada peserta terverifikasi');
      return;
    }
    setIsSending(true);
    setSendingProgress(0);
    try {
      await saveTemplates(); // Always save before send
      await loadTemplates(); // Always reload before send
      const mappedTemplates = mapTemplatesForBackend(templates);
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/bulk-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: mappedTemplates })
      });
      if (response.ok) {
        // Monitor sending progress
        const checkProgress = setInterval(async () => {
          try {
            const progressResponse = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/stats`);
            if (progressResponse.ok) {
              const stats = await progressResponse.json();
              const progress = (stats.sent / stats.total) * 100;
              setSendingProgress(progress);
              if (progress >= 100) {
                clearInterval(checkProgress);
                setIsSending(false);
                toast.success('Semua sertifikat berhasil dikirim');
                fetchParticipants(); // Refresh data
              }
            }
          } catch (error) {
            console.error('Error checking sending progress:', error);
          }
        }, 1000);
        // Cleanup after 10 minutes
        setTimeout(() => {
          clearInterval(checkProgress);
          setIsSending(false);
          toast.error('Kirim sertifikat terlalu lama/gagal. Cek koneksi atau server.');
        }, 600000);
      } else {
        const err = await response.json();
        throw new Error(err.error || 'Failed to send certificates');
      }
    } catch (error) {
      console.error('Error sending certificates:', error);
      toast.error('Gagal mengirim sertifikat');
      setIsSending(false);
    }
  };

  const selectedElementData = selectedElement 
    ? templates[activeTemplate]?.elements.find(el => el.id === selectedElement)
    : null;

  // Sidebar template button click handler
  const handleTemplateSwitch = (index: number) => {
    setActiveTemplate(index);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
              >
                ← Back to Event
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Generate Multi-Template Certificates</h1>
              <p className="text-gray-600">Design up to 6 different certificate templates for participants.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => void saveTemplates()}
                disabled={isSaving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                💾 Save
              </button>
              <button
                onClick={() => void previewTemplate()}
                disabled={isSaving || isDeleting || isUploading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                👁️ Preview
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Template Selection & Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Template Tabs */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Templates ({templates.length}/6)</h3>
                <button
                  onClick={() => void addTemplate()}
                  disabled={templates.length >= 6 || isSaving}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  + Add
                </button>
              </div>
              
              <div className="space-y-2">
                {(templates || []).map((template, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <button
                      onClick={() => void handleTemplateSwitch(index)}
                      className={`flex-1 p-2 rounded text-left ${
                        activeTemplate === index 
                          ? 'bg-blue-100 text-black font-semibold border border-blue-300' 
                          : templates.length <= 1
                            ? 'bg-gray-100 text-gray-700 border border-gray-200'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Template {index + 1}
                    </button>
                    {templates.length > 1 && (
                      <button
                        onClick={() => void removeTemplate(index)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Hapus Template"
                        disabled={isDeleting}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Upload Template */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Upload Template {activeTemplate + 1}</h3>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => void handleImageUpload(e)}
                className="w-full p-2 border border-gray-300 rounded"
                disabled={isUploading}
              />
            </div>

            {/* Add Elements */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Add Elements</h3>
              <div className="space-y-2">
                {ELEMENT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => void addTextElement(type.id)}
                    className="w-full p-2 text-left bg-gray-100 text-gray-700 rounded border border-gray-200"
                  >
                    + {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Element Properties */}
            {selectedElementData && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Element Properties</h3>
                  <button
                    onClick={() => void removeElement(selectedElement!)}
                    className="text-red-600 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </div>
                
                <div className="space-y-3">
                  {/* Font Family */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Font Family</label>
                    <select
                      value={selectedElementData.fontFamily}
                      onChange={(e) => void updateElement(selectedElement!, { fontFamily: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded"
                    >
                      {FONT_FAMILIES.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </div>

                  {/* Font Size */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Font Size</label>
                    <input
                      type="number"
                      value={selectedElementData.fontSize}
                      onChange={(e) => void updateElement(selectedElement!, { fontSize: parseInt(e.target.value) })}
                      className="w-full p-2 border border-gray-300 rounded"
                      min="8"
                      max="72"
                    />
                  </div>

                  {/* Font Style */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Font Style</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void updateElement(selectedElement!, { 
                          fontWeight: selectedElementData.fontWeight === 'bold' ? 'normal' : 'bold' 
                        })}
                        className={`px-3 py-1 rounded border ${
                          selectedElementData.fontWeight === 'bold' 
                            ? 'bg-blue-100 border-blue-300 text-blue-700' 
                            : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <strong>B</strong>
                      </button>
                      <button
                        onClick={() => void updateElement(selectedElement!, { 
                          fontStyle: selectedElementData.fontStyle === 'italic' ? 'normal' : 'italic' 
                        })}
                        className={`px-3 py-1 rounded border ${
                          selectedElementData.fontStyle === 'italic' 
                            ? 'bg-blue-100 border-blue-300 text-blue-700' 
                            : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <em>I</em>
                      </button>
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Color</label>
                    <input
                      type="color"
                      value={selectedElementData.color}
                      onChange={(e) => {
                        let color = e.target.value;
                        if (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fff') {
                          toast.error('Warna putih tidak diperbolehkan, gunakan warna gelap agar teks terlihat.');
                          color = '#222222';
                        }
                        void updateElement(selectedElement!, { color });
                      }}
                      className="w-full h-10 border border-gray-300 rounded"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Canvas Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold text-black text-lg mb-4">Template {activeTemplate + 1} Design</h3>
              
              <div 
                ref={canvasRef}
                className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden"
                style={{ 
                  width: `${CANVAS_WIDTH}px`, 
                  height: `${CANVAS_HEIGHT}px`,
                  backgroundImage: templates[activeTemplate]?.image ? `url(${templates[activeTemplate].image})` : 'none',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  backgroundColor: templates[activeTemplate]?.image ? 'transparent' : '#f9fafb'
                }}
              >
                {!templates[activeTemplate]?.image && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    Upload template image to start designing
                  </div>
                )}

                {Array.isArray(templates[activeTemplate]?.elements) &&
                  templates[activeTemplate].elements.map((element) => (
                    <Rnd
                      key={element.id}
                      size={{ width: element.width, height: element.height }}
                      position={{ x: element.x - element.width / 2, y: element.y - element.height / 2 }}
                      bounds="parent"
                      minWidth={20}
                      minHeight={20}
                      maxWidth={CANVAS_WIDTH}
                      maxHeight={CANVAS_HEIGHT}
                      onDragStop={(e, d) => {
                        let x = Math.max(0, Math.min(d.x, CANVAS_WIDTH - element.width));
                        let y = Math.max(0, Math.min(d.y, CANVAS_HEIGHT - element.height));
                        void updateElement(element.id, { x: x + element.width / 2, y: y + element.height / 2 });
                      }}
                      onResizeStop={(e, direction, ref, delta, position) => {
                        let width = Math.max(20, Math.min(parseInt(ref.style.width), CANVAS_WIDTH));
                        let height = Math.max(20, Math.min(parseInt(ref.style.height), CANVAS_HEIGHT));
                        let x = Math.max(0, Math.min(position.x, CANVAS_WIDTH - width));
                        let y = Math.max(0, Math.min(position.y, CANVAS_HEIGHT - height));
                        void updateElement(element.id, { width, height, x: x + width / 2, y: y + height / 2 });
                      }}
                      onClick={() => setSelectedElement(element.id)}
                      className={`cursor-move ${selectedElement === element.id ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          fontSize: `${element.fontSize}px`,
                          fontFamily: getCssFontFamily(element.fontFamily),
                          fontWeight: element.fontWeight,
                          fontStyle: element.fontStyle,
                          color: (element.color?.toLowerCase() === '#ffffff' || element.color?.toLowerCase() === '#fff') ? '#222222' : element.color,
                          textShadow: (element.color?.toLowerCase() === '#ffffff' || element.color?.toLowerCase() === '#fff') ? '0 0 4px #222' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          backgroundColor: selectedElement === element.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          border: selectedElement === element.id ? '1px solid #3b82f6' : '1px dashed rgba(0,0,0,0.3)',
                          borderRadius: '4px'
                        }}
                      >
                        {element.text}
                      </div>
                    </Rnd>
                  ))
                }
              </div>

              {/* Tambahkan info ukuran canvas & gambar template */}
              <div className="text-xs text-gray-500 mt-2 text-center">
                Ukuran canvas & gambar template: 842 x 595 px (A4 landscape)
              </div>

              {/* Bulk Actions - Moved below canvas */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-4">Bulk Actions</h4>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => void generateCertificates()}
                    disabled={isGenerating || templates.some(t => !t.image) || isSaving}
                    className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Generating... {Math.round(generationProgress)}%
                      </>
                    ) : (
                      <>
                        📄 Generate All Certificates
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => void sendAllCertificates()}
                    disabled={isSending}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Sending... {Math.round(sendingProgress)}%
                      </>
                    ) : (
                      <>
                        📧 Send All Certificates
                      </>
                    )}
                  </button>

                  <div className="text-sm text-gray-600 flex items-center">
                    Total Participants: {participants.length}
                  </div>
                </div>

                {/* Progress Bars */}
                {isGenerating && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Generating Certificates</span>
                      <span>{Math.round(generationProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${generationProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {isSending && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Sending Certificates</span>
                      <span>{Math.round(sendingProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${sendingProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}