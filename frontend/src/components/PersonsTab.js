import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  UserCircle,
  Plus,
  Search,
  Link as LinkIcon,
  Unlink,
  Phone,
  Mail,
  MapPin,
  Loader2,
  ExternalLink,
  User,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PersonsTab = ({ caseData, canEdit, onUpdate }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [casePersons, setCasePersons] = useState({ reporter: null, offender: null });
  const [loading, setLoading] = useState(true);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkRole, setLinkRole] = useState('reporter');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [personToUnlink, setPersonToUnlink] = useState(null);

  const isManager = user?.role === 'manager';

  const fetchCasePersons = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/cases/${caseData.id}/persons`);
      setCasePersons(response.data);
    } catch (error) {
      console.error('Failed to fetch case persons:', error);
    } finally {
      setLoading(false);
    }
  }, [caseData.id]);

  useEffect(() => {
    fetchCasePersons();
  }, [fetchCasePersons]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setSearching(true);
    try {
      const response = await axios.get(`${API}/persons?search=${encodeURIComponent(searchTerm)}&limit=10`);
      setSearchResults(response.data.persons || []);
    } catch (error) {
      toast.error('Failed to search persons');
    } finally {
      setSearching(false);
    }
  };

  const handleLinkPerson = async (personId) => {
    setLinking(true);
    try {
      await axios.post(`${API}/cases/${caseData.id}/persons/${personId}?role=${linkRole}`);
      toast.success(`Person linked as ${linkRole}`);
      setLinkDialogOpen(false);
      setSearchTerm('');
      setSearchResults([]);
      fetchCasePersons();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to link person');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkPerson = async () => {
    if (!personToUnlink) return;
    
    try {
      await axios.delete(`${API}/cases/${caseData.id}/persons/${personToUnlink.id}?role=${personToUnlink.role}`);
      toast.success('Person unlinked from case');
      setUnlinkDialogOpen(false);
      setPersonToUnlink(null);
      fetchCasePersons();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to unlink person');
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

  const PersonCard = ({ person, role, canUnlink }) => {
    if (!person) {
      return (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <UserCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-[#505A5F] mb-3">No {role} linked</p>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLinkRole(role);
                  setLinkDialogOpen(true);
                }}
                data-testid={`link-${role}-btn`}
              >
                <Plus className="w-4 h-4 mr-2" />
                Link {role}
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#F3F2F1] rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-[#505A5F]" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {person.title && `${person.title} `}
                  {person.first_name} {person.last_name}
                </CardTitle>
                <Badge className={getTypeBadgeColor(role)}>{role}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/persons')}
                title="View in Persons Database"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              {canUnlink && canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    setPersonToUnlink({ ...person, role });
                    setUnlinkDialogOpen(true);
                  }}
                  data-testid={`unlink-${role}-btn`}
                >
                  <Unlink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="space-y-2">
            {person.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-[#505A5F]" />
                <a href={`tel:${person.phone}`} className="hover:underline">{person.phone}</a>
              </div>
            )}
            {person.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-[#505A5F]" />
                <a href={`mailto:${person.email}`} className="hover:underline">{person.email}</a>
              </div>
            )}
            {isManager && person.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-[#505A5F] mt-0.5" />
                <div>
                  {person.address.line1 && <span>{person.address.line1}, </span>}
                  {person.address.city && <span>{person.address.city}, </span>}
                  {person.address.postcode && <span>{person.address.postcode}</span>}
                </div>
              </div>
            )}
            {isManager && person.date_of_birth && (
              <p className="text-xs text-[#505A5F]">DOB: {person.date_of_birth}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#005EA5]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="persons-tab">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5" />
            Linked Persons
          </CardTitle>
          <CardDescription>
            Reporter and offender information for this case
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3 text-blue-800">Reporter</h3>
              <PersonCard person={casePersons.reporter} role="reporter" canUnlink={true} />
            </div>
            <div>
              <h3 className="font-medium mb-3 text-red-800">Offender</h3>
              <PersonCard person={casePersons.offender} role="offender" canUnlink={true} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link Person Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link {linkRole.charAt(0).toUpperCase() + linkRole.slice(1)}</DialogTitle>
            <DialogDescription>
              Search for an existing person or create a new one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                data-testid="person-search-input"
              />
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {searchResults.map((person) => (
                  <div
                    key={person.id}
                    className="p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                    onClick={() => handleLinkPerson(person.id)}
                  >
                    <div>
                      <p className="font-medium">
                        {person.title && `${person.title} `}
                        {person.first_name} {person.last_name}
                      </p>
                      <p className="text-sm text-[#505A5F]">
                        {person.phone || person.email || 'No contact info'}
                      </p>
                    </div>
                    <Badge className={getTypeBadgeColor(person.person_type)}>
                      {person.person_type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {searchTerm && searchResults.length === 0 && !searching && (
              <p className="text-center text-[#505A5F] py-4">
                No persons found. 
                <Button
                  variant="link"
                  className="text-[#005EA5]"
                  onClick={() => {
                    setLinkDialogOpen(false);
                    navigate('/persons');
                  }}
                >
                  Create new person
                </Button>
              </p>
            )}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setLinkDialogOpen(false);
                  navigate('/persons');
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Person
              </Button>
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation Dialog */}
      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Unlink Person
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink {personToUnlink?.first_name} {personToUnlink?.last_name} as {personToUnlink?.role} from this case?
              The person record will remain in the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlinkPerson} className="bg-red-600 hover:bg-red-700">
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PersonsTab;
