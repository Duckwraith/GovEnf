import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  ArrowRight,
  Trash2,
  Car,
  Cigarette,
  Dog,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentCases, setRecentCases] = useState([]);
  const [myCases, setMyCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const isOfficer = user?.role === 'officer';

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, casesRes] = await Promise.all([
        axios.get(`${API}/stats/overview`),
        axios.get(`${API}/cases`)
      ]);
      setStats(statsRes.data);
      
      // For officers, filter to show only their assigned cases
      if (isOfficer && user?.id) {
        const assignedCases = casesRes.data.filter(c => c.assigned_to === user.id);
        setMyCases(assignedCases);
        setRecentCases(assignedCases.slice(0, 5));
      } else {
        setRecentCases(casesRes.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCaseTypeIcon = (type) => {
    const icons = {
      fly_tipping: Trash2,
      fly_tipping_private: Trash2,
      fly_tipping_organised: Trash2,
      abandoned_vehicle: Car,
      nuisance_vehicle: Car,
      littering: Cigarette,
      dog_fouling: Dog,
      pspo_dog_control: Shield
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
      littering: 'Littering',
      dog_fouling: 'Dog Fouling',
      pspo_dog_control: 'PSPO Dog Control',
      untidy_land: 'Untidy Land',
      high_hedges: 'High Hedges',
      waste_carrier_licensing: 'Waste Carrier'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  // Different stats for officers vs supervisors/managers
  const officerStatCards = [
    {
      title: 'My Cases',
      value: myCases.length,
      icon: FileText,
      color: 'text-[#005EA5]',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Investigating',
      value: myCases.filter(c => c.status === 'investigating').length,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'Closed by Me',
      value: myCases.filter(c => c.status === 'closed').length,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'New Assigned',
      value: myCases.filter(c => c.status === 'assigned').length,
      icon: AlertTriangle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  const managerStatCards = [
    {
      title: 'Total Cases',
      value: stats?.total_cases || 0,
      icon: FileText,
      color: 'text-[#005EA5]',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Open Cases',
      value: stats?.open_cases || 0,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'Closed Cases',
      value: stats?.closed_cases || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Unassigned',
      value: stats?.unassigned_cases || 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  const statCards = isOfficer ? officerStatCards : managerStatCards;

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B0C0C]">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-[#505A5F] mt-1">
            Here's what's happening with your enforcement cases today.
          </p>
        </div>
        <Link to="/cases">
          <Button className="bg-[#005EA5] hover:bg-[#004F8C]" data-testid="view-all-cases-btn">
            View All Cases
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="stat-card border" data-testid={`stat-card-${card.title.toLowerCase().replace(' ', '-')}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#505A5F]">{card.title}</p>
                    <p className="stat-card-value mt-2 text-[#0B0C0C]">{card.value}</p>
                  </div>
                  <div className={`w-12 h-12 ${card.bgColor} rounded-sm flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cases by Type & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cases by Type */}
        <Card className="border">
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Cases by Type</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Object.entries(stats?.cases_by_type || {}).map(([type, count]) => {
                const Icon = getCaseTypeIcon(type);
                const percentage = stats?.total_cases > 0 
                  ? Math.round((count / stats.total_cases) * 100) 
                  : 0;
                return (
                  <div key={type} className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#F3F2F1] rounded-sm flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#505A5F]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[#0B0C0C]">
                          {getCaseTypeLabel(type)}
                        </span>
                        <span className="text-sm text-[#505A5F]">{count}</span>
                      </div>
                      <div className="h-2 bg-[#F3F2F1] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#005EA5] transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(stats?.cases_by_type || {}).length === 0 && (
                <p className="text-center text-[#505A5F] py-4">No cases yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cases by Status */}
        <Card className="border">
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Cases by Status</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {['new', 'assigned', 'investigating', 'closed'].map((status) => {
                const count = stats?.cases_by_status?.[status] || 0;
                const statusLabels = {
                  new: { label: 'New', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
                  assigned: { label: 'Assigned', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
                  investigating: { label: 'Investigating', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
                  closed: { label: 'Closed', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' }
                };
                const { label, icon: Icon, color, bg } = statusLabels[status];
                return (
                  <div 
                    key={status} 
                    className={`p-4 ${bg} rounded-sm`}
                    data-testid={`status-${status}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="text-sm font-medium text-[#0B0C0C]">{label}</span>
                    </div>
                    <p className="text-2xl font-bold text-[#0B0C0C] font-mono">{count}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Cases */}
      <Card className="border">
        <CardHeader className="border-b flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Cases</CardTitle>
          <Link to="/cases" className="text-sm text-[#005EA5] hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentCases.length === 0 ? (
            <div className="p-8 text-center text-[#505A5F]">
              <FileText className="w-12 h-12 mx-auto mb-3 text-[#B1B4B6]" />
              <p>No cases found</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentCases.map((caseItem) => {
                const Icon = getCaseTypeIcon(caseItem.case_type);
                return (
                  <Link
                    key={caseItem.id}
                    to={`/cases/${caseItem.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-[#F3F2F1] transition-colors"
                    data-testid={`case-row-${caseItem.id}`}
                  >
                    <div className="w-10 h-10 bg-[#F3F2F1] rounded-sm flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#505A5F]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="reference-number">{caseItem.reference_number}</span>
                        <Badge className={`${getStatusBadge(caseItem.status)} capitalize`}>
                          {caseItem.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-[#0B0C0C] truncate mt-1">
                        {caseItem.description}
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-[#505A5F]">
                        {new Date(caseItem.created_at).toLocaleDateString('en-GB')}
                      </p>
                      {caseItem.assigned_to_name && (
                        <p className="text-xs text-[#505A5F] mt-1">
                          {caseItem.assigned_to_name}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#B1B4B6]" />
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

export default Dashboard;
