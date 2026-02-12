import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus,
  Search,
  UserCircle,
  Edit,
  Trash2,
  Loader2,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  ExternalLink,
  AlertTriangle,
  User,
  Users as UsersIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PERSON_TYPES = [
  { value: 'reporter', label: 'Reporter' },
  { value: 'offender', label: 'Offender' },
  { value: 'both', label: 'Both' }
];

const TITLES = [
  { value: 'Mr', label: 'Mr' },
  { value: 'Mrs', label: 'Mrs' },
  { value: 'Ms', label: 'Ms' },
  { value: 'Miss', label: 'Miss' },
  { value: 'Dr', label: 'Dr' },
  { value: 'Other', label: 'Other' }
];

const ID_TYPES = [
  { value: 'driving_license', label: 'Driving License' },
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'other', label: 'Other' }
];

const emptyFormData = {
  person_type: 'reporter',
  title: '',
  first_name: '',
  last_name: '',
  date_of_birth: '',
  address: {
    line1: '',
    line2: '',
    city: '',
    county: '',
    postcode: ''
  },
  phone: '',
  email: '',
  id_type: '',
  id_number: '',
  notes: ''
};

const Persons = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personCases, setPersonCases] = useState([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergePrimary, setMergePrimary] = useState(null);
  const [mergeSecondary, setMergeSecondary] = useState(null);
  const [merging, setMerging] = useState(false);

  const isManager = user?.role === 'manager';

  const fetchPersons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (typeFilter !== 'all') params.append('person_type', typeFilter);
      
      const response = await axios.get(`${API}/persons?${params.toString()}`);
      setPersons(response.data.persons || []);
    } catch (error) {
      toast.error('Failed to fetch persons');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, typeFilter]);

  useEffect(() => {
    fetchPersons();
  }, [fetchPersons]);

  const handleOpenDialog = (person = null) => {
    if (person) {
      setEditingPerson(person);
      setFormData({
        person_type: person.person_type || 'reporter',
        title: person.title || '',
        first_name: person.first_name || '',
        last_name: person.last_name || '',
        date_of_birth: person.date_of_birth || '',
        address: person.address || emptyFormData.address,
        phone: person.phone || '',
        email: person.email || '',
        id_type: person.id_type || '',
        id_number: person.id_number || '',
        notes: person.notes || ''
      });
    } else {
      setEditingPerson(null);
      setFormData(emptyFormData);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPerson(null);
    setFormData(emptyFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      toast.error('First name and last name are required');
      return;
    }

    setSaving(true);
    try {
      if (editingPerson) {
        await axios.put(`${API}/persons/${editingPerson.id}`, formData);
        toast.success('Person updated successfully');
      } else {
        await axios.post(`${API}/persons`, formData);
        toast.success('Person created successfully');
      }
      handleCloseDialog();
      fetchPersons();
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      const errorMessage = typeof errorDetail === 'string' 
        ? errorDetail 
        : (Array.isArray(errorDetail) ? errorDetail.map(e => e.msg || e).join(', ') : 'Failed to save person');
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!personToDelete) return;
    
    try {
      await axios.delete(`${API}/persons/${personToDelete.id}`);
      toast.success('Person deleted successfully');
      setDeleteDialogOpen(false);
      setPersonToDelete(null);
      fetchPersons();
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      const errorMessage = typeof errorDetail === 'string' 
        ? errorDetail 
        : 'Failed to delete person';
      toast.error(errorMessage);
    }
  };

  const handleViewDetails = async (person) => {
    setSelectedPerson(person);
    setDetailsOpen(true);
    
    try {
      const response = await axios.get(`${API}/persons/${person.id}/cases`);
      setPersonCases(response.data || []);
    } catch (error) {
      console.error('Failed to fetch person cases:', error);
      setPersonCases([]);
    }
  };

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'reporter': return 'bg-blue-100 text-blue-800';
      case 'offender': return 'bg-red-100 text-red-800';
      case 'both': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateAddressField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  return (
    <div className="space-y-6" data-testid="persons-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B0C0C]">Persons Database</h1>
          <p className="text-[#505A5F] mt-1">Manage reporters and offenders linked to cases</p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="bg-[#005EA5] hover:bg-[#004F8C]"
          data-testid="add-person-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Person
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="person-search"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="type-filter">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {PERSON_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Persons List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#005EA5]" />
            </div>
          ) : persons.length === 0 ? (
            <div className="text-center p-12 text-[#505A5F]">
              <UserCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No persons found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Linked Cases</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {persons.map((person) => (
                  <TableRow key={person.id} data-testid={`person-row-${person.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F3F2F1] rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-[#505A5F]" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {person.title && `${person.title} `}
                            {person.first_name} {person.last_name}
                          </p>
                          {isManager && person.date_of_birth && (
                            <p className="text-xs text-[#505A5F]">DOB: {person.date_of_birth}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeBadgeColor(person.person_type)}>
                        {person.person_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {person.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3" />
                            {person.phone}
                          </div>
                        )}
                        {person.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="w-3 h-3" />
                            {person.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {person.linked_cases?.length || 0} case(s)
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(person)}
                          data-testid={`view-person-${person.id}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(person)}
                          data-testid={`edit-person-${person.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {isManager && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setPersonToDelete(person);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`delete-person-${person.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Person Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPerson ? 'Edit Person' : 'Add New Person'}</DialogTitle>
            <DialogDescription>
              {editingPerson ? 'Update person details' : 'Add a new reporter or offender to the database'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Person Type *</Label>
                <Select value={formData.person_type} onValueChange={(v) => updateFormField('person_type', v)}>
                  <SelectTrigger data-testid="person-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSON_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Select value={formData.title} onValueChange={(v) => updateFormField('title', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent>
                    {TITLES.map(title => (
                      <SelectItem key={title.value} value={title.value}>{title.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => updateFormField('date_of_birth', e.target.value)}
                  disabled={!isManager && editingPerson}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => updateFormField('first_name', e.target.value)}
                  placeholder="Enter first name"
                  required
                  data-testid="person-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => updateFormField('last_name', e.target.value)}
                  placeholder="Enter last name"
                  required
                  data-testid="person-last-name"
                />
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => updateFormField('phone', e.target.value)}
                  placeholder="e.g., 07123 456789"
                  data-testid="person-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormField('email', e.target.value)}
                  placeholder="email@example.com"
                  data-testid="person-email"
                />
              </div>
            </div>

            {/* Address - only editable by managers */}
            {(isManager || !editingPerson) && (
              <>
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Address
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Address Line 1</Label>
                      <Input
                        value={formData.address?.line1 || ''}
                        onChange={(e) => updateAddressField('line1', e.target.value)}
                        placeholder="Street address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Address Line 2</Label>
                      <Input
                        value={formData.address?.line2 || ''}
                        onChange={(e) => updateAddressField('line2', e.target.value)}
                        placeholder="Apartment, suite, etc."
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          value={formData.address?.city || ''}
                          onChange={(e) => updateAddressField('city', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>County</Label>
                        <Input
                          value={formData.address?.county || ''}
                          onChange={(e) => updateAddressField('county', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Postcode</Label>
                        <Input
                          value={formData.address?.postcode || ''}
                          onChange={(e) => updateAddressField('postcode', e.target.value.toUpperCase())}
                          placeholder="e.g., SW1A 1AA"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ID Documents */}
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Identification (Manager Only)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ID Type</Label>
                      <Select value={formData.id_type} onValueChange={(v) => updateFormField('id_type', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select ID type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ID_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>ID Number</Label>
                      <Input
                        value={formData.id_number}
                        onChange={(e) => updateFormField('id_number', e.target.value)}
                        placeholder="Enter ID number"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => updateFormField('notes', e.target.value)}
                placeholder="Additional notes about this person..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#005EA5] hover:bg-[#004F8C]"
                disabled={saving}
                data-testid="save-person-btn"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingPerson ? 'Update Person' : 'Add Person'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Person Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5" />
              {selectedPerson?.title && `${selectedPerson.title} `}
              {selectedPerson?.first_name} {selectedPerson?.last_name}
            </DialogTitle>
            <Badge className={getTypeBadgeColor(selectedPerson?.person_type)}>
              {selectedPerson?.person_type}
            </Badge>
          </DialogHeader>

          {selectedPerson && (
            <Tabs defaultValue="details" className="mt-4">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="cases">Linked Cases ({personCases.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedPerson.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-[#505A5F]" />
                        <span>{selectedPerson.phone}</span>
                      </div>
                    )}
                    {selectedPerson.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#505A5F]" />
                        <span>{selectedPerson.email}</span>
                      </div>
                    )}
                    {!selectedPerson.phone && !selectedPerson.email && (
                      <p className="text-[#505A5F] text-sm">No contact information available</p>
                    )}
                  </CardContent>
                </Card>

                {isManager && (
                  <>
                    {selectedPerson.address && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Address</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-[#505A5F] mt-1" />
                            <div>
                              {selectedPerson.address.line1 && <p>{selectedPerson.address.line1}</p>}
                              {selectedPerson.address.line2 && <p>{selectedPerson.address.line2}</p>}
                              {selectedPerson.address.city && <p>{selectedPerson.address.city}</p>}
                              {selectedPerson.address.county && <p>{selectedPerson.address.county}</p>}
                              {selectedPerson.address.postcode && <p>{selectedPerson.address.postcode}</p>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedPerson.date_of_birth && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Personal Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-[#505A5F]" />
                            <span>DOB: {selectedPerson.date_of_birth}</span>
                          </div>
                          {selectedPerson.id_type && (
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#505A5F]" />
                              <span>{selectedPerson.id_type}: {selectedPerson.id_number}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {selectedPerson.notes && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-[#505A5F]">{selectedPerson.notes}</p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="cases" className="mt-4">
                {personCases.length === 0 ? (
                  <div className="text-center p-8 text-[#505A5F]">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No cases linked to this person</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {personCases.map((caseItem) => (
                      <Card
                        key={caseItem.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setDetailsOpen(false);
                          navigate(`/cases/${caseItem.id}`);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{caseItem.reference_number}</p>
                              <p className="text-sm text-[#505A5F]">{caseItem.case_type?.replace(/_/g, ' ')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {caseItem.person_role?.map(role => (
                                <Badge key={role} className={getTypeBadgeColor(role)}>
                                  {role}
                                </Badge>
                              ))}
                              <Badge variant="outline">{caseItem.status}</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delete Person
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {personToDelete?.first_name} {personToDelete?.last_name}?
              This action cannot be undone.
              {personToDelete?.linked_cases?.length > 0 && (
                <span className="block mt-2 text-red-600">
                  This person is linked to {personToDelete.linked_cases.length} case(s) and cannot be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={personToDelete?.linked_cases?.length > 0}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Persons;
