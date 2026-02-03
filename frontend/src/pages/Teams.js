import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Users2,
  Edit,
  Trash2,
  Loader2,
  UsersRound,
  CheckCircle,
  XCircle,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TEAM_TYPES = [
  { value: 'enforcement', label: 'Enforcement' },
  { value: 'environmental_crimes', label: 'Environmental Crimes' },
  { value: 'waste_management', label: 'Waste Management' }
];

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState({});
  const [newTeam, setNewTeam] = useState({
    name: '',
    team_type: 'enforcement',
    description: ''
  });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await axios.get(`${API}/teams`);
      setTeams(response.data);
    } catch (error) {
      toast.error('Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId) => {
    try {
      const response = await axios.get(`${API}/teams/${teamId}/members`);
      setTeamMembers(response.data);
    } catch (error) {
      toast.error('Failed to fetch team members');
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    
    if (!newTeam.name || !newTeam.team_type) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      await axios.post(`${API}/teams`, newTeam);
      toast.success('Team created successfully');
      setShowCreateDialog(false);
      setNewTeam({ name: '', team_type: 'enforcement', description: '' });
      fetchTeams();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put(`${API}/teams/${selectedTeam.id}`, {
        name: selectedTeam.name,
        description: selectedTeam.description,
        is_active: selectedTeam.is_active
      });
      toast.success('Team updated successfully');
      setShowEditDialog(false);
      setSelectedTeam(null);
      fetchTeams();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update team');
    }
  };

  const handleDeleteTeam = async () => {
    try {
      await axios.delete(`${API}/teams/${selectedTeam.id}`);
      toast.success('Team deleted successfully');
      setShowDeleteDialog(false);
      setSelectedTeam(null);
      fetchTeams();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete team');
    }
  };

  const toggleTeamExpansion = async (teamId) => {
    if (!expandedTeams[teamId]) {
      await fetchTeamMembers(teamId);
    }
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  const getTeamTypeBadge = (type) => {
    const styles = {
      enforcement: 'bg-blue-100 text-blue-800',
      environmental_crimes: 'bg-purple-100 text-purple-800',
      waste_management: 'bg-green-100 text-green-800'
    };
    return styles[type] || 'bg-gray-100 text-gray-800';
  };

  const getTeamTypeLabel = (type) => {
    return TEAM_TYPES.find(t => t.value === type)?.label || type;
  };

  const filteredTeams = teams.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      t.name?.toLowerCase().includes(s) ||
      t.description?.toLowerCase().includes(s) ||
      t.team_type?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6" data-testid="teams-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B0C0C]">Team Management</h1>
          <p className="text-[#505A5F] mt-1">
            {teams.length} team{teams.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#005EA5] hover:bg-[#004F8C]" data-testid="create-team-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" data-testid="create-team-dialog">
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Add a new team to organize your enforcement officers.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTeam} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Team Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., North District Enforcement"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  data-testid="team-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team_type">Team Type *</Label>
                <Select
                  value={newTeam.team_type}
                  onValueChange={(value) => setNewTeam({ ...newTeam, team_type: value })}
                >
                  <SelectTrigger data-testid="team-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the team's responsibilities..."
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  rows={3}
                  data-testid="team-description-input"
                />
              </div>

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
                  data-testid="submit-team-btn"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Team'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="border">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#505A5F]" />
            <Input
              placeholder="Search teams by name, type, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="team-search-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Teams List */}
      <Card className="border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner" />
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center py-12">
              <Users2 className="w-12 h-12 mx-auto mb-3 text-[#B1B4B6]" />
              <p className="text-[#505A5F]">No teams found</p>
              <p className="text-sm text-[#B1B4B6] mt-1">Create a team to get started</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTeams.map((team) => (
                <Collapsible 
                  key={team.id}
                  open={expandedTeams[team.id]}
                  onOpenChange={() => toggleTeamExpansion(team.id)}
                >
                  <div className="p-4 hover:bg-gray-50" data-testid={`team-row-${team.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-1">
                            <ChevronRight 
                              className={`w-4 h-4 transition-transform ${expandedTeams[team.id] ? 'rotate-90' : ''}`} 
                            />
                          </Button>
                        </CollapsibleTrigger>
                        <div className="w-10 h-10 bg-[#F3F2F1] rounded-lg flex items-center justify-center">
                          <UsersRound className="w-5 h-5 text-[#505A5F]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-[#0B0C0C]">{team.name}</h3>
                            {team.is_active === false && (
                              <Badge variant="outline" className="text-red-600 border-red-200">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`${getTeamTypeBadge(team.team_type)} text-xs`}>
                              {getTeamTypeLabel(team.team_type)}
                            </Badge>
                            {team.description && (
                              <span className="text-sm text-[#505A5F]">
                                • {team.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTeam(team);
                            setShowEditDialog(true);
                          }}
                          data-testid={`edit-team-${team.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTeam(team);
                            setShowDeleteDialog(true);
                          }}
                          data-testid={`delete-team-${team.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pl-16 bg-gray-50">
                      <div className="border rounded-lg bg-white p-4">
                        <h4 className="text-sm font-medium text-[#0B0C0C] mb-3">Team Members</h4>
                        {teamMembers.length === 0 ? (
                          <p className="text-sm text-[#505A5F]">No members assigned to this team</p>
                        ) : (
                          <div className="space-y-2">
                            {teamMembers.map(member => (
                              <div 
                                key={member.id} 
                                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
                              >
                                <div className="w-8 h-8 bg-[#F3F2F1] rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium">
                                    {member.name?.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{member.name}</p>
                                  <p className="text-xs text-[#505A5F]">{member.email}</p>
                                </div>
                                <Badge variant="outline" className="ml-auto capitalize text-xs">
                                  {member.role}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update team details and status.
            </DialogDescription>
          </DialogHeader>
          {selectedTeam && (
            <form onSubmit={handleUpdateTeam} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Team Name</Label>
                <Input
                  id="edit-name"
                  value={selectedTeam.name}
                  onChange={(e) => setSelectedTeam({ ...selectedTeam, name: e.target.value })}
                  data-testid="edit-team-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Team Type</Label>
                <Input 
                  value={getTeamTypeLabel(selectedTeam.team_type)} 
                  disabled 
                  className="bg-gray-50" 
                />
                <p className="text-xs text-[#505A5F]">Team type cannot be changed after creation</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={selectedTeam.description || ''}
                  onChange={(e) => setSelectedTeam({ ...selectedTeam, description: e.target.value })}
                  rows={3}
                  data-testid="edit-team-description-input"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label>Team Active</Label>
                  <p className="text-xs text-[#505A5F]">Inactive teams won't receive new cases</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedTeam.is_active !== false ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTeam({ 
                      ...selectedTeam, 
                      is_active: selectedTeam.is_active === false ? true : false 
                    })}
                    data-testid="toggle-team-active-btn"
                  >
                    {selectedTeam.is_active !== false ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#005EA5] hover:bg-[#004F8C]"
                  data-testid="save-team-btn"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTeam?.name}"? This action cannot be undone.
              Teams with assigned cases cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeam}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-team-btn"
            >
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Teams;
