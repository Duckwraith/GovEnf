import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { toast } from 'sonner';
import {
  MapPin,
  Save,
  Loader2,
  History,
  Navigation,
  AlertCircle,
  Copy,
  Search,
  RefreshCw
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Map center controller component
const MapCenterController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
};

// Draggable marker component
const DraggableMarker = ({ position, onPositionChange, draggable }) => {
  const markerRef = useRef(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        onPositionChange(newPos.lat, newPos.lng);
      }
    },
  };

  // Click handler for setting position on map click
  useMapEvents({
    click(e) {
      if (draggable) {
        onPositionChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  if (!position || !position[0] || !position[1]) return null;

  return (
    <Marker
      draggable={draggable}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
};

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LocationTab = ({ caseData, canEdit, onLocationUpdate }) => {
  const [location, setLocation] = useState({
    address: caseData?.location?.address || '',
    postcode: caseData?.location?.postcode || '',
    latitude: caseData?.location?.latitude || null,
    longitude: caseData?.location?.longitude || null,
    what3words: caseData?.location?.what3words || ''
  });
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [w3wSearch, setW3wSearch] = useState('');
  const [w3wLoading, setW3wLoading] = useState(false);
  const [w3wEnabled, setW3wEnabled] = useState(true);
  const [mapSettings, setMapSettings] = useState({
    default_latitude: 51.5074,
    default_longitude: -0.1278,
    default_zoom: 12
  });

  useEffect(() => {
    fetchSettings();
    checkW3wStatus();
  }, []);

  useEffect(() => {
    if (caseData?.location) {
      setLocation({
        address: caseData.location.address || '',
        postcode: caseData.location.postcode || '',
        latitude: caseData.location.latitude || null,
        longitude: caseData.location.longitude || null,
        what3words: caseData.location.what3words || ''
      });
    }
  }, [caseData?.location]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      if (response.data?.map_settings) {
        setMapSettings(response.data.map_settings);
      }
      if (response.data?.enable_what3words !== undefined) {
        setW3wEnabled(response.data.enable_what3words);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const checkW3wStatus = async () => {
    try {
      const response = await axios.get(`${API}/w3w/status`);
      setW3wEnabled(response.data.enabled && response.data.api_available);
    } catch (error) {
      setW3wEnabled(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setLocation(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleMarkerDrag = async (lat, lng) => {
    const roundedLat = Math.round(lat * 1000000) / 1000000;
    const roundedLng = Math.round(lng * 1000000) / 1000000;
    
    setLocation(prev => ({
      ...prev,
      latitude: roundedLat,
      longitude: roundedLng
    }));
    setHasChanges(true);
    
    // Auto-fetch address for the new coordinates
    await fetchAddressFromCoords(roundedLat, roundedLng);
  };

  const fetchAddressFromCoords = async (lat, lng) => {
    try {
      const response = await axios.get(`${API}/geocode/reverse`, {
        params: { lat, lng }
      });
      if (response.data.success) {
        setLocation(prev => ({
          ...prev,
          address: response.data.address || prev.address,
          postcode: response.data.postcode || prev.postcode
        }));
        if (response.data.address) {
          toast.success('Address auto-filled from coordinates');
        }
      }
    } catch (error) {
      console.error('Failed to fetch address:', error);
    }
  };

  const handleSaveLocation = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/cases/${caseData.id}/location`, location);
      toast.success('Location updated successfully');
      setHasChanges(false);
      setEditMode(false);
      if (onLocationUpdate) {
        onLocationUpdate(location);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update location');
    } finally {
      setSaving(false);
    }
  };

  // Convert W3W to coordinates
  const handleW3wSearch = async () => {
    if (!w3wSearch.trim()) {
      toast.error('Please enter a what3words address');
      return;
    }
    
    // Clean up the input - remove /// prefix if present
    let words = w3wSearch.trim().toLowerCase();
    if (words.startsWith('///')) {
      words = words.substring(3);
    }
    
    setW3wLoading(true);
    try {
      const response = await axios.post(`${API}/w3w/convert`, { words });
      if (response.data.success) {
        setLocation(prev => ({
          ...prev,
          latitude: response.data.latitude,
          longitude: response.data.longitude,
          what3words: `///${response.data.words}`
        }));
        setHasChanges(true);
        toast.success(`Location set from what3words: ${response.data.words}`);
        setW3wSearch('');
      } else {
        toast.error(response.data.error || 'Could not convert what3words address');
      }
    } catch (error) {
      toast.error('Failed to convert what3words address');
    } finally {
      setW3wLoading(false);
    }
  };

  // Convert coordinates to W3W
  const handleGetW3wFromCoords = async () => {
    if (!location.latitude || !location.longitude) {
      toast.error('Please set coordinates first');
      return;
    }
    
    setW3wLoading(true);
    try {
      const response = await axios.post(`${API}/w3w/convert`, {
        latitude: location.latitude,
        longitude: location.longitude
      });
      if (response.data.success) {
        setLocation(prev => ({
          ...prev,
          what3words: `///${response.data.words}`
        }));
        setHasChanges(true);
        toast.success('what3words address retrieved');
      } else {
        toast.error(response.data.error || 'Could not get what3words address');
      }
    } catch (error) {
      toast.error('what3words service unavailable');
    } finally {
      setW3wLoading(false);
    }
  };

  // Copy W3W to clipboard
  const handleCopyW3w = async () => {
    if (!location.what3words) {
      toast.error('No what3words address to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(location.what3words);
      toast.success('what3words copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const getMapCenter = () => {
    if (location.latitude && location.longitude) {
      return [location.latitude, location.longitude];
    }
    // Use admin settings default, NOT London
    return [mapSettings.default_latitude, mapSettings.default_longitude];
  };

  const getMapZoom = () => {
    if (location.latitude && location.longitude) {
      return 15;
    }
    return mapSettings.default_zoom;
  };

  const hasLocation = location.latitude && location.longitude;
  const hasAnyLocationData = location.address || location.postcode || location.what3words || hasLocation;

  return (
    <Card className="border">
      <CardHeader className="border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Case Location
          </CardTitle>
          <CardDescription>
            Location details and map for this case
          </CardDescription>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {!editMode ? (
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                data-testid="edit-location-btn"
              >
                Edit Location
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditMode(false);
                    setHasChanges(false);
                    setLocation({
                      address: caseData?.location?.address || '',
                      postcode: caseData?.location?.postcode || '',
                      latitude: caseData?.location?.latitude || null,
                      longitude: caseData?.location?.longitude || null,
                      what3words: caseData?.location?.what3words || ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveLocation}
                  className="bg-[#005EA5] hover:bg-[#004F8C]"
                  disabled={saving || !hasChanges}
                  data-testid="save-location-btn"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Confirm Location
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Location Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Address</Label>
            <Input
              placeholder="Street address"
              value={location.address}
              onChange={(e) => handleFieldChange('address', e.target.value)}
              disabled={!editMode}
              data-testid="location-address"
              className={!editMode ? 'bg-gray-50' : ''}
            />
          </div>
          <div className="space-y-2">
            <Label>Postcode</Label>
            <Input
              placeholder="e.g., SW1A 1AA"
              value={location.postcode}
              onChange={(e) => handleFieldChange('postcode', e.target.value.toUpperCase())}
              disabled={!editMode}
              data-testid="location-postcode"
              className={!editMode ? 'bg-gray-50' : ''}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>what3words Reference</span>
              {location.what3words && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleCopyW3w}
                  data-testid="copy-w3w-btn"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., ///filled.count.soap"
                value={location.what3words}
                onChange={(e) => handleFieldChange('what3words', e.target.value.toLowerCase())}
                disabled={!editMode}
                data-testid="location-w3w"
                className={!editMode ? 'bg-gray-50 flex-1' : 'flex-1'}
              />
              {editMode && w3wEnabled && hasLocation && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleGetW3wFromCoords}
                  disabled={w3wLoading}
                  title="Get W3W from coordinates"
                  data-testid="refresh-w3w-btn"
                >
                  <RefreshCw className={`w-4 h-4 ${w3wLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
            <p className="text-xs text-[#505A5F]">Format: ///word.word.word</p>
          </div>
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input
              type="number"
              step="0.000001"
              placeholder="51.507351"
              value={location.latitude || ''}
              onChange={(e) => handleFieldChange('latitude', e.target.value ? parseFloat(e.target.value) : null)}
              disabled={!editMode}
              data-testid="location-lat"
              className={!editMode ? 'bg-gray-50' : ''}
            />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input
              type="number"
              step="0.000001"
              placeholder="-0.127758"
              value={location.longitude || ''}
              onChange={(e) => handleFieldChange('longitude', e.target.value ? parseFloat(e.target.value) : null)}
              disabled={!editMode}
              data-testid="location-lng"
              className={!editMode ? 'bg-gray-50' : ''}
            />
          </div>
        </div>

        {/* Lookup Address Button (in edit mode with coordinates) */}
        {editMode && hasLocation && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fetchAddressFromCoords(location.latitude, location.longitude)}
              className="text-sm"
              data-testid="lookup-address-btn"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Lookup Address from Coordinates
            </Button>
          </div>
        )}

        {/* W3W Search (only in edit mode and when W3W is enabled) */}
        {editMode && w3wEnabled && (
          <div className="p-4 bg-blue-50 rounded-lg space-y-3">
            <Label className="text-blue-800 font-medium">Search by what3words</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter what3words address (e.g., filled.count.soap)"
                value={w3wSearch}
                onChange={(e) => setW3wSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleW3wSearch()}
                className="flex-1 bg-white"
                data-testid="w3w-search-input"
              />
              <Button
                onClick={handleW3wSearch}
                disabled={w3wLoading || !w3wSearch.trim()}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="w3w-search-btn"
              >
                {w3wLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Set Location
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-blue-600">
              Enter a what3words address to automatically set the map location
            </p>
          </div>
        )}

        {/* Location validation message */}
        {!hasAnyLocationData && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-sm text-amber-800">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">At least one location field (address, postcode, coordinates, or what3words) is required.</span>
          </div>
        )}

        <Separator />

        {/* Map */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              Location Map
            </Label>
            {editMode && (
              <span className="text-xs text-[#505A5F]">
                Click on the map or drag the pin to set location
              </span>
            )}
          </div>
          <div className="h-[400px] rounded-sm overflow-hidden border" data-testid="location-map">
            <MapContainer
              center={getMapCenter()}
              zoom={getMapZoom()}
              style={{ height: '100%', width: '100%' }}
            >
              <MapCenterController center={getMapCenter()} zoom={getMapZoom()} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <DraggableMarker
                position={hasLocation ? [location.latitude, location.longitude] : null}
                onPositionChange={handleMarkerDrag}
                draggable={editMode}
              />
            </MapContainer>
          </div>
          {!hasLocation && (
            <p className="text-sm text-[#505A5F] text-center">
              No coordinates set. {editMode ? 'Click on the map to set a location.' : 'Edit to add coordinates.'}
            </p>
          )}
        </div>

        {/* Location History */}
        {caseData?.location_history && caseData.location_history.length > 0 && (
          <>
            <Separator />
            <Accordion type="single" collapsible>
              <AccordionItem value="history">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Location History ({caseData.location_history.length} changes)
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 mt-2">
                    {caseData.location_history.slice().reverse().map((entry, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 rounded-sm text-sm"
                        data-testid={`location-history-${index}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{entry.changed_by_name}</span>
                          <span className="text-xs text-[#505A5F]">
                            {new Date(entry.changed_at).toLocaleString('en-GB')}
                          </span>
                        </div>
                        <div className="text-[#505A5F]">
                          {entry.location?.address && <p>Address: {entry.location.address}</p>}
                          {entry.location?.postcode && <p>Postcode: {entry.location.postcode}</p>}
                          {entry.location?.latitude && entry.location?.longitude && (
                            <p>Coordinates: {entry.location.latitude}, {entry.location.longitude}</p>
                          )}
                          {entry.location?.what3words && <p>what3words: {entry.location.what3words}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationTab;
