import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ArrowLeft,
  FileText,
  Trash2,
  Car,
  Cigarette,
  Dog,
  Shield,
  MapPin,
  Clock,
  User,
  Camera,
  MessageSquare,
  History,
  Upload,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  Download,
  ClipboardList,
  Save,
  Lock,
  Globe,
  Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CaseTypeFields } from '@/components/CaseTypeFields';
import LocationTab from '@/components/LocationTab';
import FPNTab from '@/components/FPNTab';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CaseDetail = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  
  const [caseData, setCaseData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [userTeamTypes, setUserTeamTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showClosureDialog, setShowClosureDialog] = useState(false);
  const [closureReason, setClosureReason] = useState('');
  const [finalNote, setFinalNote] = useState('');
  const [closingCase, setClosingCase] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [typeSpecificFields, setTypeSpecificFields] = useState({});
  const [savingFields, setSavingFields] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  const isWasteManagement = userTeamTypes.includes('waste_management');

  const fetchCaseData = useCallback(async () => {
    try {
      const [caseRes, notesRes, evidenceRes, auditRes] = await Promise.all([
        axios.get(`${API}/cases/${caseId}`),
        axios.get(`${API}/cases/${caseId}/notes`),
        axios.get(`${API}/cases/${caseId}/evidence`),
        axios.get(`${API}/cases/${caseId}/audit-log`)
      ]);
      setCaseData(caseRes.data);
      setTypeSpecificFields(caseRes.data.type_specific_fields || {});
      setNotes(notesRes.data);
      setEvidence(evidenceRes.data);
      setAuditLog(auditRes.data);
    } catch (error) {
      toast.error('Failed to load case');
      navigate('/cases');
    } finally {
      setLoading(false);
    }
  }, [caseId, navigate]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data.filter(u => u.role !== 'manager'));
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await axios.get(`${API}/teams`);
      setTeams(response.data);
    } catch (error) {
      console.error('Failed to fetch teams');
    }
  };

  const fetchUserTeamTypes = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      if (response.data?.teams) {
        const teamsRes = await axios.get(`${API}/teams`);
        const userTeams = teamsRes.data.filter(t => response.data.teams.includes(t.id));
        setUserTeamTypes(userTeams.map(t => t.team_type));
      }
    } catch (error) {
      console.error('Failed to fetch user team types');
    }
  };

  useEffect(() => {
    fetchCaseData();
    fetchUsers();
    fetchTeams();
    fetchUserTeamTypes();
  }, [fetchCaseData]);

  const handleStatusChange = async (newStatus) => {
    // If closing, show the closure dialog
    if (newStatus === 'closed') {
      setShowClosureDialog(true);
      return;
    }
    
    try {
      await axios.put(`${API}/cases/${caseId}`, { status: newStatus });
      toast.success('Status updated');
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleCloseCase = async () => {
    if (!closureReason.trim() || !finalNote.trim()) {
      toast.error('Please provide both closure reason and final note');
      return;
    }
    
    setClosingCase(true);
    try {
      await axios.put(`${API}/cases/${caseId}`, { 
        status: 'closed',
        closure_reason: closureReason,
        final_note: finalNote
      });
      toast.success('Case closed successfully');
      setShowClosureDialog(false);
      setClosureReason('');
      setFinalNote('');
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to close case');
    } finally {
      setClosingCase(false);
    }
  };

  const handleReopenCase = async () => {
    try {
      await axios.put(`${API}/cases/${caseId}`, { status: 'investigating' });
      toast.success('Case reopened');
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reopen case');
    }
  };

  const handleSaveDescription = async () => {
    try {
      await axios.put(`${API}/cases/${caseId}`, { description: newDescription });
      toast.success('Description updated');
      setEditingDescription(false);
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update description');
    }
  };

  const handleAssign = async (userId) => {
    try {
      await axios.put(`${API}/cases/${caseId}`, { assigned_to: userId });
      toast.success('Case assigned');
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign case');
    }
  };

  const handleSaveTypeSpecificFields = async () => {
    setSavingFields(true);
    try {
      await axios.put(`${API}/cases/${caseId}`, { type_specific_fields: typeSpecificFields });
      toast.success('Case details saved');
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save details');
    } finally {
      setSavingFields(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmittingNote(true);
    try {
      await axios.post(`${API}/cases/${caseId}/notes`, { content: newNote });
      setNewNote('');
      toast.success('Note added');
      fetchCaseData();
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await axios.post(`${API}/cases/${caseId}/evidence`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Evidence uploaded');
      fetchCaseData();
    } catch (error) {
      toast.error('Failed to upload evidence');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteEvidence = async (evidenceId) => {
    try {
      await axios.delete(`${API}/cases/${caseId}/evidence/${evidenceId}`);
      toast.success('Evidence deleted');
      fetchCaseData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete evidence');
    }
  };

  const getCaseTypeIcon = (type) => {
    const icons = {
      fly_tipping: Trash2,
      abandoned_vehicle: Car,
      littering: Cigarette,
      dog_fouling: Dog,
      pspo_dog_control: Shield
    };
    return icons[type] || FileText;
  };

  const getCaseTypeLabel = (type) => {
    const labels = {
      fly_tipping: 'Fly Tipping',
      abandoned_vehicle: 'Abandoned Vehicle',
      littering: 'Littering',
      dog_fouling: 'Dog Fouling',
      pspo_dog_control: 'PSPO Dog Control'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status) => {
    const styles = {
      new: 'bg-blue-100 text-blue-800',
      assigned: 'bg-amber-100 text-amber-800',
      investigating: 'bg-purple-100 text-purple-800',
      closed: 'bg-green-100 text-green-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const canEditCase = () => {
    if (user?.role === 'manager' || user?.role === 'supervisor') return true;
    if (user?.role === 'officer' && caseData?.assigned_to === user?.id) return true;
    return false;
  };

  const canAssign = () => user?.role === 'supervisor' || user?.role === 'manager';
  const canClose = () => user?.role === 'supervisor' || user?.role === 'manager';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
        <p className="text-[#505A5F]">Case not found</p>
        <Link to="/cases">
          <Button variant="link" className="text-[#005EA5] mt-2">
            Back to cases
          </Button>
        </Link>
      </div>
    );
  }

  const Icon = getCaseTypeIcon(caseData.case_type);

  return (
    <div className="space-y-6" data-testid="case-detail-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link to="/cases">
          <Button variant="ghost" size="sm" className="text-[#505A5F]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to cases
          </Button>
        </Link>
      </div>

      {/* Case Header Card */}
      <Card className="border">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className={`w-16 h-16 rounded-sm flex items-center justify-center shrink-0 type-${caseData.case_type}`}>
              <Icon className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-xl font-bold text-[#0B0C0C] font-mono">
                  {caseData.reference_number}
                </h1>
                <Badge className={`${getStatusBadge(caseData.status)} capitalize`}>
                  {caseData.status}
                </Badge>
                <span className="text-sm text-[#505A5F]">
                  {getCaseTypeLabel(caseData.case_type)}
                </span>
                {caseData.reporting_source && (
                  <Badge variant="outline" className="text-xs">
                    <Globe className="w-3 h-3 mr-1" />
                    {caseData.reporting_source === 'public' ? 'Public Report' : 
                     caseData.reporting_source === 'officer' ? 'Officer Created' : 'Other Source'}
                  </Badge>
                )}
              </div>
              <p className="text-[#0B0C0C] mb-4">{caseData.description}</p>
              
              {/* System Metadata - Read Only */}
              <div className="flex flex-wrap gap-4 text-sm text-[#505A5F] mb-3">
                <div className="flex items-center gap-1" title="Read-only: System generated">
                  <Lock className="w-3 h-3" />
                  <Clock className="w-4 h-4" />
                  <span>Created {new Date(caseData.created_at).toLocaleString('en-GB')}</span>
                </div>
                {caseData.updated_at && caseData.updated_at !== caseData.created_at && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Updated {new Date(caseData.updated_at).toLocaleString('en-GB')}</span>
                  </div>
                )}
                {caseData.closed_at && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Closed {new Date(caseData.closed_at).toLocaleString('en-GB')}</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-4 text-sm text-[#505A5F]">
                {caseData.location?.address && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{caseData.location.address}</span>
                    {caseData.location.postcode && (
                      <span className="font-mono">{caseData.location.postcode}</span>
                    )}
                  </div>
                )}
                {caseData.assigned_to_name && (
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>Assigned to {caseData.assigned_to_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions - Supervisor/Manager controls */}
            <div className="flex flex-col gap-3 shrink-0">
              {canAssign() && (
                <div className="space-y-1">
                  <Label className="text-xs text-[#505A5F]">Assign to</Label>
                  <Select
                    value={caseData.assigned_to || ''}
                    onValueChange={handleAssign}
                  >
                    <SelectTrigger className="w-48" data-testid="assign-select">
                      <SelectValue placeholder="Select officer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Status change - Officers can change to investigating, only supervisors/managers can close */}
              {canEditCase() && (
                <div className="space-y-1">
                  <Label className="text-xs text-[#505A5F]">
                    Status 
                    {!canClose() && <span className="ml-1">(Supervisors close cases)</span>}
                  </Label>
                  <Select
                    value={caseData.status}
                    onValueChange={handleStatusChange}
                    disabled={caseData.status === 'closed'}
                  >
                    <SelectTrigger className="w-48" data-testid="status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      {canClose() && <SelectItem value="closed">Closed</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="bg-white border flex-wrap">
          <TabsTrigger value="details" data-testid="details-tab">
            <ClipboardList className="w-4 h-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="location" data-testid="location-tab">
            <MapPin className="w-4 h-4 mr-2" />
            Location
          </TabsTrigger>
          {caseData.fpn_issued && (
            <TabsTrigger value="fpn" data-testid="fpn-tab">
              <Receipt className="w-4 h-4 mr-2" />
              Fixed Penalty
              {caseData.fpn_details?.paid && (
                <CheckCircle className="w-3 h-3 ml-1 text-green-600" />
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="notes" data-testid="notes-tab">
            <MessageSquare className="w-4 h-4 mr-2" />
            Notes ({notes.length})
          </TabsTrigger>
          <TabsTrigger value="evidence" data-testid="evidence-tab">
            <Camera className="w-4 h-4 mr-2" />
            Evidence ({evidence.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="timeline-tab">
            <History className="w-4 h-4 mr-2" />
            Timeline
          </TabsTrigger>
        </TabsList>

        {/* Details Tab - Case Type Specific Fields */}
        <TabsContent value="details">
          <Card className="border">
            <CardHeader className="border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Case Details</CardTitle>
                <CardDescription>
                  Offence-specific information for this case
                </CardDescription>
              </div>
              {canEditCase() && (
                <Button
                  onClick={handleSaveTypeSpecificFields}
                  className="bg-[#005EA5] hover:bg-[#004F8C]"
                  disabled={savingFields}
                  data-testid="save-details-btn"
                >
                  {savingFields ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Details
                    </>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-6">
              <CaseTypeFields
                caseType={caseData.case_type}
                data={typeSpecificFields}
                onChange={setTypeSpecificFields}
                readOnly={!canEditCase()}
                hasEvidence={evidence.length > 0}
                isWasteManagement={isWasteManagement}
              />
              {!caseData.case_type && (
                <p className="text-[#505A5F] text-center py-8">No case type specific fields available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location Tab */}
        <TabsContent value="location">
          <LocationTab
            caseData={caseData}
            canEdit={canEditCase()}
            onLocationUpdate={() => fetchCaseData()}
          />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card className="border">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Case Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {/* Add Note Form */}
              {canEditCase() && (
                <form onSubmit={handleAddNote} className="mb-6">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    data-testid="new-note-input"
                    className="mb-3"
                  />
                  <Button
                    type="submit"
                    className="bg-[#005EA5] hover:bg-[#004F8C]"
                    disabled={!newNote.trim() || submittingNote}
                    data-testid="submit-note-btn"
                  >
                    {submittingNote ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Note'
                    )}
                  </Button>
                </form>
              )}

              {/* Notes List */}
              {notes.length === 0 ? (
                <div className="text-center py-8 text-[#505A5F]">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-[#B1B4B6]" />
                  <p>No notes yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-4 bg-[#F3F2F1] rounded-sm"
                      data-testid={`note-${note.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-[#0B0C0C]">{note.created_by_name}</span>
                        <span className="text-xs text-[#505A5F]">
                          {new Date(note.created_at).toLocaleString('en-GB')}
                        </span>
                      </div>
                      <p className="text-[#0B0C0C] whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence">
          <Card className="border">
            <CardHeader className="border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Evidence</CardTitle>
              {canEditCase() && (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    data-testid="evidence-file-input"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#005EA5] hover:bg-[#004F8C]"
                    disabled={uploading}
                    data-testid="upload-evidence-btn"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {evidence.length === 0 ? (
                <div className="text-center py-8 text-[#505A5F]">
                  <Camera className="w-12 h-12 mx-auto mb-3 text-[#B1B4B6]" />
                  <p>No evidence uploaded</p>
                </div>
              ) : (
                <div className="evidence-grid">
                  {evidence.map((item) => (
                    <div
                      key={item.id}
                      className="evidence-item group cursor-pointer"
                      data-testid={`evidence-${item.id}`}
                      onClick={() => {
                        if (item.file_type?.startsWith('image/')) {
                          setSelectedImage(item);
                          setShowImageModal(true);
                        }
                      }}
                    >
                      {item.file_type?.startsWith('image/') ? (
                        <img
                          src={`data:${item.file_type};base64,${item.file_data}`}
                          alt={item.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#F3F2F1]">
                          <FileText className="w-8 h-8 text-[#505A5F]" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {canClose() && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEvidence(item.id);
                            }}
                            data-testid={`delete-evidence-${item.id}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-white/90 p-2">
                        <p className="text-xs truncate">{item.filename}</p>
                        <p className="text-xs text-[#505A5F]">{item.uploaded_by_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card className="border">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Audit Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {auditLog.length === 0 ? (
                <div className="text-center py-8 text-[#505A5F]">
                  <History className="w-12 h-12 mx-auto mb-3 text-[#B1B4B6]" />
                  <p>No activity recorded</p>
                </div>
              ) : (
                <div className="timeline">
                  {auditLog.map((log) => (
                    <div key={log.id} className="timeline-item" data-testid={`audit-${log.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-[#0B0C0C]">{log.action}</p>
                          <p className="text-sm text-[#505A5F]">{log.details}</p>
                          <p className="text-xs text-[#505A5F] mt-1">
                            by {log.performed_by_name}
                          </p>
                        </div>
                        <span className="text-xs text-[#505A5F] shrink-0">
                          {new Date(log.performed_at).toLocaleString('en-GB')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reporter Info */}
      {(caseData.reporter_name || caseData.reporter_contact) && (
        <Card className="border">
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Reporter Information</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {caseData.reporter_name && (
                <div>
                  <Label className="text-xs text-[#505A5F]">Name</Label>
                  <p className="text-[#0B0C0C]">{caseData.reporter_name}</p>
                </div>
              )}
              {caseData.reporter_contact && (
                <div>
                  <Label className="text-xs text-[#505A5F]">Contact</Label>
                  <p className="text-[#0B0C0C]">{caseData.reporter_contact}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.filename}</DialogTitle>
            <DialogDescription>
              Uploaded by {selectedImage?.uploaded_by_name}
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <img
              src={`data:${selectedImage.file_type};base64,${selectedImage.file_data}`}
              alt={selectedImage.filename}
              className="w-full rounded-sm"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Case Closure Dialog */}
      <Dialog open={showClosureDialog} onOpenChange={setShowClosureDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close Case</DialogTitle>
            <DialogDescription>
              Please provide a closure reason and final note to close this case.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="closure-reason">Closure Reason *</Label>
              <Select value={closureReason} onValueChange={setClosureReason}>
                <SelectTrigger data-testid="closure-reason-select">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolved">Issue Resolved</SelectItem>
                  <SelectItem value="no_action_required">No Action Required</SelectItem>
                  <SelectItem value="insufficient_evidence">Insufficient Evidence</SelectItem>
                  <SelectItem value="prosecution_successful">Prosecution Successful</SelectItem>
                  <SelectItem value="warning_issued">Warning Issued</SelectItem>
                  <SelectItem value="fpn_paid">FPN Paid</SelectItem>
                  <SelectItem value="transferred">Transferred to Another Agency</SelectItem>
                  <SelectItem value="duplicate">Duplicate Case</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="final-note">Final Note *</Label>
              <Textarea
                id="final-note"
                placeholder="Provide a summary of the case outcome..."
                value={finalNote}
                onChange={(e) => setFinalNote(e.target.value)}
                rows={4}
                data-testid="closure-final-note"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowClosureDialog(false)}
                disabled={closingCase}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCloseCase}
                className="bg-red-600 hover:bg-red-700"
                disabled={closingCase || !closureReason || !finalNote.trim()}
                data-testid="confirm-close-case-btn"
              >
                {closingCase ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Closing...
                  </>
                ) : (
                  'Close Case'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseDetail;
