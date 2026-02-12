import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Trash2,
  Car,
  Cigarette,
  Dog,
  Shield,
  ArrowRight,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CaseTypeFields } from '@/components/CaseTypeFields';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Cases = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    case_type: '',
    search: '',
    vrm_search: ''
  });
  const [newCase, setNewCase] = useState({
    case_type: '',
    description: '',
    location: {
      postcode: '',
      address: ''
    },
    type_specific_fields: {}
  });
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const fetchCases = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.case_type && filters.case_type !== 'all') params.append('case_type', filters.case_type);
      if (filters.vrm_search) params.append('vrm_search', filters.vrm_search);
      
      const response = await axios.get(`${API}/cases?${params.toString()}`);
      setCases(response.data);
    } catch (error) {
      toast.error('Failed to fetch cases');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.case_type, filters.vrm_search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Check for duplicate VRM before creating case
  const checkDuplicateVRM = async () => {
    const caseType = newCase.case_type;
    const typeFields = newCase.type_specific_fields;
    
    // Get VRM based on case type
    let vrm = null;
    if (caseType === 'abandoned_vehicle' && typeFields?.abandoned_vehicle) {
      vrm = typeFields.abandoned_vehicle.registration_number;
    } else if (caseType?.includes('nuisance_vehicle') && typeFields?.nuisance_vehicle) {
      vrm = typeFields.nuisance_vehicle.registration_number;
    }
    
    if (!vrm) return null;
    
    try {
      const response = await axios.get(`${API}/cases/check-duplicate-vrm?vrm=${encodeURIComponent(vrm)}&case_type=${caseType}`);
      if (response.data.count > 0) {
        return response.data;
      }
    } catch (error) {
      console.error('Error checking duplicate VRM:', error);
    }
    return null;
  };

  const handleCreateCase = async (e, skipDuplicateCheck = false) => {
    e?.preventDefault();
    
    if (!newCase.case_type || !newCase.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check for duplicate VRM if not skipping
    if (!skipDuplicateCheck) {
      const duplicates = await checkDuplicateVRM();
      if (duplicates && duplicates.count > 0) {
        setDuplicateWarning(duplicates);
        setShowDuplicateDialog(true);
        return;
      }
    }

    setCreating(true);
    try {
      const payload = {
        ...newCase,
        type_specific_fields: newCase.type_specific_fields && Object.keys(newCase.type_specific_fields).length > 0 
          ? newCase.type_specific_fields 
          : null
      };
      const response = await axios.post(`${API}/cases`, payload);
      toast.success(`Case ${response.data.reference_number} created successfully`);
      setShowCreateDialog(false);
      setShowDuplicateDialog(false);
      setDuplicateWarning(null);
      setNewCase({
        case_type: '',
        description: '',
        location: { postcode: '', address: '' },
        type_specific_fields: {}
      });
      fetchCases();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const handleSelfAssign = async (caseId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await axios.post(`${API}/cases/${caseId}/self-assign`);
      toast.success('Case assigned to you');
      fetchCases();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign case');
    }
  };

  const getCaseTypeIcon = (type) => {
    const icons = {
      fly_tipping: Trash2,
      fly_tipping_private: Trash2,
      fly_tipping_organised: Trash2,
      abandoned_vehicle: Car,
      nuisance_vehicle: Car,
      nuisance_vehicle_seller: Car,
      nuisance_vehicle_parking: Car,
      nuisance_vehicle_asb: Car,
      littering: Cigarette,
      dog_fouling: Dog,
      pspo_dog_control: Shield,
      untidy_land: FileText,
      high_hedges: FileText,
      waste_carrier_licensing: FileText,
      complex_environmental: Shield
    };
    return icons[type] || FileText;
  };

  const getCaseTypeLabel = (type) => {
    const labels = {
      fly_tipping: 'Fly Tipping',
      fly_tipping_private: 'Fly Tipping (Private)',
      fly_tipping_organised: 'Fly Tipping (Organised)',
      abandoned_vehicle: 'Abandoned Vehicle',
      nuisance_vehicle: 'Nuisance Vehicle',
      nuisance_vehicle_seller: 'On-Street Seller',
      nuisance_vehicle_parking: 'Parking Nuisance',
      nuisance_vehicle_asb: 'ASB Vehicle',
      littering: 'Littering',
      dog_fouling: 'Dog Fouling',
      pspo_dog_control: 'PSPO Dog Control',
      untidy_land: 'Untidy Land',
      high_hedges: 'High Hedges',
      waste_carrier_licensing: 'Waste Carrier',
      complex_environmental: 'Environmental Crime'
    };
    return labels[type] || type?.replace(/_/g, ' ');
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

  const filteredCases = cases.filter(c => {
    if (!filters.search) return true;
    const search = filters.search.toLowerCase();
    return (
      c.reference_number?.toLowerCase().includes(search) ||
      c.description?.toLowerCase().includes(search) ||
      c.location?.address?.toLowerCase().includes(search) ||
      c.location?.postcode?.toLowerCase().includes(search)
    );
  });

  const clearFilters = () => {
    setFilters({ status: '', case_type: '', search: '' });
  };

  const hasActiveFilters = filters.status || filters.case_type || filters.search;

  return (
    <div className="space-y-6" data-testid="cases-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B0C0C]">Cases</h1>
          <p className="text-[#505A5F] mt-1">
            {filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#005EA5] hover:bg-[#004F8C]" data-testid="create-case-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Case
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[85vh]" data-testid="create-case-dialog">
            <DialogHeader>
              <DialogTitle>Create New Case</DialogTitle>
              <DialogDescription>
                Fill in the details to create a new enforcement case.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-4">
              <form onSubmit={handleCreateCase} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="case_type">Case Type *</Label>
                  <Select
                    value={newCase.case_type}
                    onValueChange={(value) => setNewCase({ 
                      ...newCase, 
                      case_type: value,
                      type_specific_fields: {} // Reset specific fields when type changes
                    })}
                  >
                    <SelectTrigger data-testid="case-type-select">
                      <SelectValue placeholder="Select case type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fly_tipping">Fly Tipping (General)</SelectItem>
                      <SelectItem value="fly_tipping_private">Fly Tipping (Private Land)</SelectItem>
                      <SelectItem value="fly_tipping_organised">Fly Tipping (Organised Crime)</SelectItem>
                      <SelectItem value="abandoned_vehicle">Abandoned Vehicle</SelectItem>
                      <SelectItem value="nuisance_vehicle">Nuisance Vehicle</SelectItem>
                      <SelectItem value="nuisance_vehicle_seller">Nuisance Vehicle (On-Street Seller)</SelectItem>
                      <SelectItem value="nuisance_vehicle_parking">Nuisance Vehicle (Parking)</SelectItem>
                      <SelectItem value="nuisance_vehicle_asb">Nuisance Vehicle (ASB)</SelectItem>
                      <SelectItem value="littering">Littering</SelectItem>
                      <SelectItem value="dog_fouling">Dog Fouling</SelectItem>
                      <SelectItem value="pspo_dog_control">PSPO Dog Control</SelectItem>
                      <SelectItem value="untidy_land">Untidy Land</SelectItem>
                      <SelectItem value="high_hedges">High Hedges</SelectItem>
                      <SelectItem value="waste_carrier_licensing">Waste Carrier / Licensing</SelectItem>
                      <SelectItem value="complex_environmental">Complex Environmental Offence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the issue..."
                    value={newCase.description}
                    onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
                    data-testid="case-description-input"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      placeholder="e.g. SW1A 1AA"
                      value={newCase.location.postcode}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        location: { ...newCase.location, postcode: e.target.value }
                      })}
                      data-testid="case-postcode-input"
                    />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="Street address"
                    value={newCase.location.address}
                    onChange={(e) => setNewCase({
                      ...newCase,
                      location: { ...newCase.location, address: e.target.value }
                    })}
                    data-testid="case-address-input"
                  />
                </div>
              </div>

              {/* Case-Type Specific Fields */}
              {newCase.case_type && (
                <CaseTypeFields
                  caseType={newCase.case_type}
                  data={newCase.type_specific_fields}
                  onChange={(fields) => setNewCase({ ...newCase, type_specific_fields: fields })}
                />
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#005EA5] hover:bg-[#004F8C]"
                  disabled={creating}
                  data-testid="submit-case-btn"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Case'
                  )}
                </Button>
              </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#505A5F]" />
              <Input
                placeholder="Search by reference, description, or location..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9"
                data-testid="search-input"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="w-full sm:w-[160px]" data-testid="status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.case_type}
              onValueChange={(value) => setFilters({ ...filters, case_type: value })}
            >
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="fly_tipping">Fly Tipping</SelectItem>
                <SelectItem value="fly_tipping_private">Fly Tipping (Private)</SelectItem>
                <SelectItem value="fly_tipping_organised">Fly Tipping (Organised)</SelectItem>
                <SelectItem value="abandoned_vehicle">Abandoned Vehicle</SelectItem>
                <SelectItem value="nuisance_vehicle">Nuisance Vehicle</SelectItem>
                <SelectItem value="littering">Littering</SelectItem>
                <SelectItem value="dog_fouling">Dog Fouling</SelectItem>
                <SelectItem value="pspo_dog_control">PSPO Dog Control</SelectItem>
                <SelectItem value="untidy_land">Untidy Land</SelectItem>
                <SelectItem value="high_hedges">High Hedges</SelectItem>
                <SelectItem value="waste_carrier_licensing">Waste Carrier</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="text-[#505A5F]">
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cases List */}
      <Card className="border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-3 text-[#B1B4B6]" />
              <p className="text-[#505A5F]">No cases found</p>
              {hasActiveFilters && (
                <Button
                  variant="link"
                  onClick={clearFilters}
                  className="text-[#005EA5] mt-2"
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredCases.map((caseItem) => {
                const Icon = getCaseTypeIcon(caseItem.case_type);
                const canSelfAssign = !caseItem.assigned_to && user?.role === 'officer';
                
                return (
                  <Link
                    key={caseItem.id}
                    to={`/cases/${caseItem.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-[#F3F2F1] transition-colors group"
                    data-testid={`case-item-${caseItem.id}`}
                  >
                    <div className={`w-10 h-10 rounded-sm flex items-center justify-center type-${caseItem.case_type}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="reference-number font-medium">{caseItem.reference_number}</span>
                        <Badge className={`${getStatusBadge(caseItem.status)} capitalize text-xs`}>
                          {caseItem.status}
                        </Badge>
                        <span className="text-xs text-[#505A5F] capitalize hidden sm:inline">
                          {getCaseTypeLabel(caseItem.case_type)}
                        </span>
                      </div>
                      <p className="text-sm text-[#0B0C0C] truncate mt-1">
                        {caseItem.description}
                      </p>
                      {caseItem.location?.address && (
                        <p className="text-xs text-[#505A5F] mt-1 truncate">
                          {caseItem.location.address}
                          {caseItem.location.postcode && `, ${caseItem.location.postcode}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-[#505A5F]">
                        {new Date(caseItem.created_at).toLocaleDateString('en-GB')}
                      </p>
                      {caseItem.assigned_to_name ? (
                        <p className="text-xs text-[#505A5F] mt-1">
                          {caseItem.assigned_to_name}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 mt-1">Unassigned</p>
                      )}
                    </div>
                    {canSelfAssign ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleSelfAssign(caseItem.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`self-assign-${caseItem.id}`}
                      >
                        Assign to me
                      </Button>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-[#B1B4B6] group-hover:text-[#005EA5] transition-colors" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Cases;
