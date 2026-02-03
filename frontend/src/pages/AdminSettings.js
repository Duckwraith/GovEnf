import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Settings,
  Save,
  Loader2,
  Building2,
  MapPin,
  Globe,
  Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    app_title: 'GovEnforce',
    organisation_name: 'Local Council',
    organisation_address: '',
    contact_email: '',
    logo_base64: null,
    map_settings: {
      default_latitude: 51.5074,
      default_longitude: -0.1278,
      default_zoom: 12
    },
    case_retention_days: 2555,
    default_working_area_postcode: '',
    enable_what3words: true,
    enable_public_reporting: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, logo_base64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="settings-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-settings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B0C0C]">Admin Settings</h1>
          <p className="text-[#505A5F] mt-1">
            Configure system-wide settings and preferences
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          className="bg-[#005EA5] hover:bg-[#004F8C]"
          disabled={saving}
          data-testid="save-settings-btn"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" data-testid="tab-general">General</TabsTrigger>
          <TabsTrigger value="map" data-testid="tab-map">Map Settings</TabsTrigger>
          <TabsTrigger value="features" data-testid="tab-features">Features</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card className="border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Organisation Details
              </CardTitle>
              <CardDescription>
                Basic information about your council and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="app_title">Application Title</Label>
                  <Input
                    id="app_title"
                    value={settings.app_title}
                    onChange={(e) => setSettings({ ...settings, app_title: e.target.value })}
                    placeholder="GovEnforce"
                    data-testid="app-title-input"
                  />
                  <p className="text-xs text-[#505A5F]">Displayed in the header and browser tab</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organisation_name">Organisation Name</Label>
                  <Input
                    id="organisation_name"
                    value={settings.organisation_name}
                    onChange={(e) => setSettings({ ...settings, organisation_name: e.target.value })}
                    placeholder="Local Council"
                    data-testid="org-name-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="organisation_address">Organisation Address</Label>
                <Textarea
                  id="organisation_address"
                  value={settings.organisation_address}
                  onChange={(e) => setSettings({ ...settings, organisation_address: e.target.value })}
                  placeholder="Council House, High Street, Town, County, Postcode"
                  rows={3}
                  data-testid="org-address-input"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#505A5F]" />
                    <Input
                      id="contact_email"
                      type="email"
                      value={settings.contact_email}
                      onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                      placeholder="enforcement@council.gov.uk"
                      className="pl-9"
                      data-testid="contact-email-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_postcode">Default Working Area Postcode</Label>
                  <Input
                    id="default_postcode"
                    value={settings.default_working_area_postcode}
                    onChange={(e) => setSettings({ ...settings, default_working_area_postcode: e.target.value })}
                    placeholder="SW1A 1AA"
                    data-testid="default-postcode-input"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Organisation Logo</Label>
                <div className="flex items-center gap-6">
                  {settings.logo_base64 ? (
                    <div className="w-20 h-20 border rounded-lg overflow-hidden bg-gray-50">
                      <img 
                        src={settings.logo_base64} 
                        alt="Logo" 
                        className="w-full h-full object-contain"
                        data-testid="logo-preview"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 border rounded-lg flex items-center justify-center bg-gray-50">
                      <Building2 className="w-8 h-8 text-[#B1B4B6]" />
                    </div>
                  )}
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="max-w-xs"
                      data-testid="logo-upload-input"
                    />
                    <p className="text-xs text-[#505A5F] mt-1">
                      Recommended size: 200x200px. PNG or JPG.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Map Settings */}
        <TabsContent value="map">
          <Card className="border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Default Map View
              </CardTitle>
              <CardDescription>
                Configure the default map center and zoom level
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="map_lat">Default Latitude</Label>
                  <Input
                    id="map_lat"
                    type="number"
                    step="0.0001"
                    value={settings.map_settings?.default_latitude || 51.5074}
                    onChange={(e) => setSettings({
                      ...settings,
                      map_settings: {
                        ...settings.map_settings,
                        default_latitude: parseFloat(e.target.value)
                      }
                    })}
                    data-testid="map-lat-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="map_lng">Default Longitude</Label>
                  <Input
                    id="map_lng"
                    type="number"
                    step="0.0001"
                    value={settings.map_settings?.default_longitude || -0.1278}
                    onChange={(e) => setSettings({
                      ...settings,
                      map_settings: {
                        ...settings.map_settings,
                        default_longitude: parseFloat(e.target.value)
                      }
                    })}
                    data-testid="map-lng-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="map_zoom">Default Zoom Level</Label>
                  <Input
                    id="map_zoom"
                    type="number"
                    min="1"
                    max="18"
                    value={settings.map_settings?.default_zoom || 12}
                    onChange={(e) => setSettings({
                      ...settings,
                      map_settings: {
                        ...settings.map_settings,
                        default_zoom: parseInt(e.target.value)
                      }
                    })}
                    data-testid="map-zoom-input"
                  />
                  <p className="text-xs text-[#505A5F]">1 (world) to 18 (street level)</p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> To find coordinates for your area, right-click on Google Maps and select "What's here?" to see the latitude and longitude.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Settings */}
        <TabsContent value="features">
          <Card className="border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Feature Toggles
              </CardTitle>
              <CardDescription>
                Enable or disable specific features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-base">Public Reporting</Label>
                    <p className="text-sm text-[#505A5F] mt-1">
                      Allow members of the public to submit reports without logging in
                    </p>
                  </div>
                  <Switch
                    checked={settings.enable_public_reporting}
                    onCheckedChange={(checked) => setSettings({ ...settings, enable_public_reporting: checked })}
                    data-testid="public-reporting-switch"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-base">what3words Integration</Label>
                    <p className="text-sm text-[#505A5F] mt-1">
                      Enable what3words location references on cases
                    </p>
                  </div>
                  <Switch
                    checked={settings.enable_what3words}
                    onCheckedChange={(checked) => setSettings({ ...settings, enable_what3words: checked })}
                    data-testid="what3words-switch"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="retention_days">Case Retention Period (Days)</Label>
                <Input
                  id="retention_days"
                  type="number"
                  min="365"
                  value={settings.case_retention_days}
                  onChange={(e) => setSettings({ ...settings, case_retention_days: parseInt(e.target.value) })}
                  className="max-w-xs"
                  data-testid="retention-days-input"
                />
                <p className="text-xs text-[#505A5F]">
                  Default is 2555 days (~7 years). Minimum 365 days. This affects GDPR compliance.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
