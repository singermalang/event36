'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Download, Eye, Mail, Users, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Event {
  id: number;
  name: string;
  type: string;
  location: string;
  start_time: string;
  end_time: string;
}

interface Template {
  template_index: number;
  template_path: string;
  template_fields: any;
  template_size: string | null;
}

interface Participant {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  registered_at: string;
  token: string;
  certificate_id?: number;
  certificate_path?: string;
  certificate_sent?: boolean;
}

interface CertificateStats {
  total_participants: number;
  participants_with_certificates: number;
  participants_without_certificates: number;
  available_templates: number;
  certificates_sent: number;
  generation_progress: number;
  can_generate_all: boolean;
}

export default function GenerateCertificatesMultiPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [stats, setStats] = useState<CertificateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  useEffect(() => {
    fetchEventData();
    fetchTemplates();
    fetchParticipants();
    fetchStats();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}`);
      if (response.ok) {
        const data = await response.json();
        setEvent(data.event);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event data');
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template`);
      if (response.ok) {
        const data = await response.json();
        setParticipants(data.participants || []);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setGenerationProgress(data.stats.generation_progress || 0);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (templateIndex: number, file: File) => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('template', file);
    formData.append('templateIndex', templateIndex.toString());

    try {
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast.success(`Template ${templateIndex} uploaded successfully`);
        fetchTemplates();
        fetchStats();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!stats?.can_generate_all) {
      toast.error('Cannot generate certificates. Make sure you have templates uploaded and participants without certificates.');
      return;
    }

    setGeneratingAll(true);
    setGenerationProgress(0);

    try {
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/bulk-generate`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Successfully generated ${data.summary.successful_generations} certificates`);
        
        if (data.summary.failed_generations > 0) {
          toast.error(`Failed to generate ${data.summary.failed_generations} certificates`);
        }

        // Refresh data
        fetchParticipants();
        fetchStats();
        setGenerationProgress(100);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to generate certificates');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate certificates');
    } finally {
      setGeneratingAll(false);
    }
  };

  const handleSendAll = async () => {
    if (!stats?.participants_with_certificates) {
      toast.error('No certificates available to send');
      return;
    }

    setSendingAll(true);

    try {
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/bulk-send`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Successfully sent ${data.summary.successful_sends} certificates`);
        
        if (data.summary.failed_sends > 0) {
          toast.error(`Failed to send ${data.summary.failed_sends} certificates`);
        }

        // Refresh data
        fetchParticipants();
        fetchStats();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to send certificates');
      }
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send certificates');
    } finally {
      setSendingAll(false);
    }
  };

  const handleGenerateIndividual = async (participantId: number) => {
    setGenerating(true);

    try {
      const response = await fetch(`/api/events/${eventId}/generate-certificates/multi-template/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ participant_id: participantId }),
      });

      if (response.ok) {
        toast.success('Certificate generated successfully');
        fetchParticipants();
        fetchStats();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to generate certificate');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate certificate');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href={`/dashboard/events/${eventId}`}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Event
            </Link>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Multi-Template Certificate Generation
            </h1>
            {event && (
              <div className="text-gray-600">
                <p className="font-medium">{event.name}</p>
                <p className="text-sm">{event.type} • {event.location}</p>
              </div>
            )}
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Participants</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_participants}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">With Certificates</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.participants_with_certificates}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Without Certificates</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.participants_without_certificates}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Templates Available</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.available_templates}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Template Upload Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Certificate Templates</h2>
          <p className="text-gray-600 mb-6">Upload up to 6 different certificate templates. Certificates will be distributed among participants using these templates.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((index) => {
              const template = templates.find(t => t.template_index === index);
              return (
                <div key={index} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <div className="mb-4">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                    <h3 className="text-sm font-medium text-gray-900 mt-2">Template {index}</h3>
                  </div>
                  
                  {template ? (
                    <div className="space-y-2">
                      <p className="text-xs text-green-600 font-medium">✓ Uploaded</p>
                      <button
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.html,.htm';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleFileUpload(index, file);
                          };
                          input.click();
                        }}
                        disabled={uploading}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Replace
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.html,.htm';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleFileUpload(index, file);
                        };
                        input.click();
                      }}
                      disabled={uploading}
                      className="flex items-center justify-center space-x-2 w-full py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Upload HTML</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Bulk Actions</h2>
          
          <div className="flex flex-wrap gap-4 items-center mb-6">
            <button
              onClick={handleGenerateAll}
              disabled={generatingAll || !stats?.can_generate_all}
              className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generatingAll ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Generating... {generationProgress}%</span>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  <span>Generate All Certificates</span>
                </>
              )}
            </button>

            <button
              onClick={handleSendAll}
              disabled={sendingAll || !stats?.participants_with_certificates}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sendingAll ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Mail className="h-5 w-5" />
                  <span>Send All Certificates</span>
                </>
              )}
            </button>

            <div className="text-sm text-gray-600">
              Total Participants: {stats?.total_participants || 0}
            </div>
          </div>

          {/* Progress Bar */}
          {stats && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Generating Certificates</span>
                <span>{generationProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Participants List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Participants</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Certificate Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {participants.map((participant) => (
                  <tr key={participant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                        <div className="text-sm text-gray-500">Token: {participant.token}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{participant.email}</div>
                      <div className="text-sm text-gray-500">{participant.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(participant.registered_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {participant.certificate_id ? (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">Generated</span>
                          {participant.certificate_sent && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Sent</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                          <span className="text-sm text-orange-600">Not Generated</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {participant.certificate_id ? (
                          <>
                            <a
                              href={participant.certificate_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </>
                        ) : (
                          <button
                            onClick={() => handleGenerateIndividual(participant.id)}
                            disabled={generating}
                            className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                          >
                            {generating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}