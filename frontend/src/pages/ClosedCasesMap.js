import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Map,
  Calendar,
  Filter,
  Loader2,
  ExternalLink,
  MapPin,
  Flame,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom green icon for closed cases
const closedCaseIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' }
];

// Heat map layer component
const HeatLayer = ({ points, map }) => {
  useEffect(() => {
    if (!map || points.length === 0) return;

    // Create heat data - each point gets a weight
    const heatData = points.map(p => [p.latitude, p.longitude, 0.5]);
    
    // Simple heat visualization using circle markers with gradient
    const heatGroup = L.layerGroup();
    
    // Group nearby points
    const gridSize = 0.01; // Approx 1km
    const grid = {};
    
    points.forEach(p => {
      const gridX = Math.floor(p.latitude / gridSize);
      const gridY = Math.floor(p.longitude / gridSize);
      const key = `${gridX},${gridY}`;
      if (!grid[key]) {
        grid[key] = { lat: 0, lng: 0, count: 0, cases: [] };
      }
      grid[key].lat += p.latitude;
      grid[key].lng += p.longitude;
      grid[key].count++;
      grid[key].cases.push(p);
    });
    
    Object.values(grid).forEach(cell => {
      const avgLat = cell.lat / cell.count;
      const avgLng = cell.lng / cell.count;
      const intensity = Math.min(cell.count / 5, 1); // Normalize to max 5 cases
      
      const circle = L.circleMarker([avgLat, avgLng], {
        radius: 15 + (cell.count * 3),
        fillColor: `rgba(255, ${Math.floor(100 - intensity * 100)}, 0, ${0.3 + intensity * 0.4})`,
        color: `rgba(255, ${Math.floor(50 - intensity * 50)}, 0, 0.8)`,
        weight: 2,
        fillOpacity: 0.6
      });
      
      circle.bindPopup(`<b>${cell.count} closed case(s)</b><br/>in this area`);
      heatGroup.addLayer(circle);
    });
    
    map.addLayer(heatGroup);
    
    return () => {
      map.removeLayer(heatGroup);
    };
  }, [map, points]);
  
  return null;
};

// Map controller for zoom-based view switching
const MapController = ({ cases, showHeatmap, zoomThreshold, onZoomChange }) => {
  const map = useMap();
  
  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };
    
    map.on('zoomend', handleZoom);
    handleZoom(); // Initial check
    
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);
  
  return null;
};

const ClosedCasesMap = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [dateRange, setDateRange] = useState('30');
  const [viewMode, setViewMode] = useState('heat'); // 'heat' or 'pins'
  const [currentZoom, setCurrentZoom] = useState(10);
  const [map, setMap] = useState(null);
  
  const ZOOM_THRESHOLD = 12; // Switch from heat to pins at this zoom level

  const fetchClosedCases = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/reports/closed-cases-map?days=${dateRange}`);
      setCases(response.data.cases || []);
      setStats(response.data.stats || null);
    } catch (error) {
      toast.error('Failed to load closed cases');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchClosedCases();
  }, [fetchClosedCases]);

  // Calculate map center
  const mapCenter = useMemo(() => {
    if (cases.length === 0) return [52.8, -1.6]; // Default to East Staffordshire area
    
    const avgLat = cases.reduce((sum, c) => sum + c.latitude, 0) / cases.length;
    const avgLng = cases.reduce((sum, c) => sum + c.longitude, 0) / cases.length;
    return [avgLat, avgLng];
  }, [cases]);

  // Determine if we should show pins or heat based on zoom
  const showPins = viewMode === 'pins' || currentZoom >= ZOOM_THRESHOLD;

  const formatCaseType = (type) => {
    return type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  return (
    <div className="space-y-6" data-testid="closed-cases-map-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B0C0C]">Closed Cases Map</h1>
          <p className="text-[#505A5F] mt-1">Visualize closed case locations and patterns</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date Range
              </label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger data-testid="date-range-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map(range => (
                    <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Map className="w-4 h-4" />
                View Mode
              </label>
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger data-testid="view-mode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="heat">
                    <span className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      Heat Map (auto-switch to pins when zoomed)
                    </span>
                  </SelectItem>
                  <SelectItem value="pins">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-600" />
                      Pin View
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {stats && (
              <div className="text-right">
                <p className="text-2xl font-bold text-[#00703C]">{stats.total_closed}</p>
                <p className="text-sm text-[#505A5F]">cases closed</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats by type */}
      {stats && Object.keys(stats.by_type).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(stats.by_type).map(([type, count]) => (
            <Card key={type} className="bg-green-50 border-green-200">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-green-800">{count}</p>
                <p className="text-xs text-green-600 truncate">{formatCaseType(type)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Map */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="h-[500px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#005EA5]" />
            </div>
          ) : cases.length === 0 ? (
            <div className="h-[500px] flex flex-col items-center justify-center text-[#505A5F]">
              <Map className="w-16 h-16 mb-4 opacity-50" />
              <p>No closed cases with locations found in this period</p>
            </div>
          ) : (
            <div className="h-[500px] rounded-lg overflow-hidden">
              <MapContainer
                center={mapCenter}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
                ref={setMap}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <MapController
                  cases={cases}
                  showHeatmap={!showPins}
                  zoomThreshold={ZOOM_THRESHOLD}
                  onZoomChange={setCurrentZoom}
                />
                
                {/* Heat layer when zoomed out */}
                {!showPins && map && (
                  <HeatLayer points={cases} map={map} />
                )}
                
                {/* Individual pins when zoomed in */}
                {showPins && cases.map((caseItem) => (
                  <Marker
                    key={caseItem.id}
                    position={[caseItem.latitude, caseItem.longitude]}
                    icon={closedCaseIcon}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <p className="font-bold text-green-800">{caseItem.reference_number}</p>
                        <Badge className="bg-green-100 text-green-800 my-1">
                          {formatCaseType(caseItem.case_type)}
                        </Badge>
                        <p className="text-sm text-gray-600 mt-1">{caseItem.description}</p>
                        {caseItem.address && (
                          <p className="text-xs text-gray-500 mt-1">{caseItem.address}</p>
                        )}
                        {caseItem.closure_reason && (
                          <p className="text-xs mt-2">
                            <strong>Closure:</strong> {caseItem.closure_reason}
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => navigate(`/cases/${caseItem.id}`)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View Case
                        </Button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-yellow-400 to-red-500" />
              <span>Heat intensity (more cases = warmer color)</span>
            </div>
            <div className="flex items-center gap-2">
              <img 
                src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" 
                alt="pin" 
                className="h-5"
              />
              <span>Closed case location</span>
            </div>
            <div className="text-[#505A5F]">
              Zoom in to see individual pins
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClosedCasesMap;
