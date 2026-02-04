import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FileText,
  Trash2,
  Car,
  Cigarette,
  Dog,
  Shield,
  Filter,
  X,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom markers by case type
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  });
};

const typeColors = {
  fly_tipping: '#D4351C',
  abandoned_vehicle: '#F47738',
  littering: '#FFDD00',
  dog_fouling: '#D53880',
  pspo_dog_control: '#4C2C92'
};

const MapView = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    case_type: ''
  });
  const [mapSettings, setMapSettings] = useState({
    default_latitude: 51.5074,
    default_longitude: -0.1278,
    default_zoom: 12
  });

  const fetchSettings = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      if (response.data?.map_settings) {
        setMapSettings(response.data.map_settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  }, []);

  const fetchCases = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.case_type && filters.case_type !== 'all') params.append('case_type', filters.case_type);
      
      const response = await axios.get(`${API}/cases?${params.toString()}`);
      // Filter cases with valid coordinates
      const casesWithLocation = response.data.filter(c => 
        c.location?.latitude && c.location?.longitude
      );
      setCases(casesWithLocation);
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Use admin-configured default center
  const defaultCenter = [mapSettings.default_latitude, mapSettings.default_longitude];
  const defaultZoom = mapSettings.default_zoom;

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

  const clearFilters = () => {
    setFilters({ status: '', case_type: '' });
  };

  const hasActiveFilters = filters.status || filters.case_type;

  return (
    <div className="space-y-6" data-testid="map-view-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B0C0C]">Map View</h1>
          <p className="text-[#505A5F] mt-1">
            {cases.length} case{cases.length !== 1 ? 's' : ''} with location data
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Filter className="w-4 h-4 text-[#505A5F]" />
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="w-[160px]" data-testid="map-status-filter">
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
              <SelectTrigger className="w-[180px]" data-testid="map-type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="fly_tipping">Fly Tipping</SelectItem>
                <SelectItem value="abandoned_vehicle">Abandoned Vehicle</SelectItem>
                <SelectItem value="littering">Littering</SelectItem>
                <SelectItem value="dog_fouling">Dog Fouling</SelectItem>
                <SelectItem value="pspo_dog_control">PSPO Dog Control</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="text-[#505A5F]">
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
            
            {/* Legend */}
            <div className="flex-1" />
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(typeColors).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[#505A5F]">{getCaseTypeLabel(type)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      <Card className="border">
        <CardContent className="p-0">
          {loading ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="spinner" />
            </div>
          ) : (
            <div className="map-container" data-testid="map-container">
              <MapContainer
                center={defaultCenter}
                zoom={defaultZoom}
                style={{ height: '500px', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {cases.map((caseItem) => (
                  <Marker
                    key={caseItem.id}
                    position={[caseItem.location.latitude, caseItem.location.longitude]}
                    icon={createCustomIcon(typeColors[caseItem.case_type] || '#005EA5')}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm font-medium">
                            {caseItem.reference_number}
                          </span>
                          <Badge className={`${getStatusBadge(caseItem.status)} capitalize text-xs`}>
                            {caseItem.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {getCaseTypeLabel(caseItem.case_type)}
                        </p>
                        <p className="text-sm mb-2 line-clamp-2">
                          {caseItem.description}
                        </p>
                        {caseItem.location.address && (
                          <p className="text-xs text-gray-500 mb-2">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {caseItem.location.address}
                          </p>
                        )}
                        <Link
                          to={`/cases/${caseItem.id}`}
                          className="text-[#005EA5] text-sm hover:underline"
                        >
                          View details →
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State */}
      {!loading && cases.length === 0 && (
        <Card className="border">
          <CardContent className="p-8 text-center">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-[#B1B4B6]" />
            <p className="text-[#505A5F]">
              No cases with location data found.
            </p>
            <p className="text-sm text-[#505A5F] mt-1">
              Cases need latitude and longitude coordinates to appear on the map.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MapView;
