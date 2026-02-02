import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Shield,
  Upload,
  X,
  Loader2,
  CheckCircle,
  MapPin,
  Camera,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CaseTypeFields } from '@/components/CaseTypeFields';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PublicReport = () => {
  const fileInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [photos, setPhotos] = useState([]);
  const [report, setReport] = useState({
    case_type: '',
    description: '',
    location: {
      postcode: '',
      address: ''
    },
    reporter_name: '',
    reporter_contact: '',
    type_specific_fields: {}
  });

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos(prev => [...prev, {
          id: Date.now() + Math.random(),
          preview: reader.result,
          base64: reader.result.split(',')[1]
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (id) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!report.case_type || !report.description) {
      toast.error('Please select a case type and provide a description');
      return;
    }

    if (!report.location.postcode && !report.location.address) {
      toast.error('Please provide a location (postcode or address)');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...report,
        evidence_files: photos.map(p => p.base64),
        type_specific_fields: report.type_specific_fields && Object.keys(report.type_specific_fields).length > 0 
          ? report.type_specific_fields 
          : null
      };
      
      const response = await axios.post(`${API}/public/report`, payload);
      setReferenceNumber(response.data.reference_number);
      setSubmitted(true);
      toast.success('Report submitted successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F3F2F1]">
        {/* Header */}
        <header className="bg-[#005EA5] text-white py-4">
          <div className="max-w-2xl mx-auto px-4 flex items-center gap-3">
            <Shield className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">Report Environmental Issue</h1>
              <p className="text-sm opacity-90">Council Enforcement Service</p>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card className="border-0 shadow-sm" data-testid="success-card">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-[#0B0C0C] mb-2">
                Report Submitted
              </h2>
              <p className="text-[#505A5F] mb-6">
                Thank you for reporting this issue. Our enforcement team will investigate.
              </p>
              <div className="bg-[#F3F2F1] p-4 rounded-sm mb-6">
                <p className="text-sm text-[#505A5F] mb-1">Your reference number:</p>
                <p className="text-2xl font-bold font-mono text-[#0B0C0C]" data-testid="reference-number">
                  {referenceNumber}
                </p>
              </div>
              <p className="text-sm text-[#505A5F]">
                Please keep this reference number for your records.
                You may be contacted if we need more information.
              </p>
              <Button
                onClick={() => {
                  setSubmitted(false);
                  setReport({
                    case_type: '',
                    description: '',
                    location: { postcode: '', address: '' },
                    reporter_name: '',
                    reporter_contact: ''
                  });
                  setPhotos([]);
                }}
                variant="outline"
                className="mt-6"
                data-testid="submit-another-btn"
              >
                Submit Another Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F2F1]" data-testid="public-report-page">
      {/* Header */}
      <header className="bg-[#005EA5] text-white py-4">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3">
          <Shield className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold">Report Environmental Issue</h1>
            <p className="text-sm opacity-90">Council Enforcement Service</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back to Login */}
        <Link to="/login" className="inline-flex items-center text-[#005EA5] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Staff login
        </Link>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Report an Issue</CardTitle>
            <CardDescription>
              Use this form to report fly-tipping, abandoned vehicles, littering, dog fouling, or other environmental issues in your area.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Issue Type */}
              <div className="space-y-2">
                <Label htmlFor="case_type">What type of issue are you reporting? *</Label>
                <Select
                  value={report.case_type}
                  onValueChange={(value) => setReport({ 
                    ...report, 
                    case_type: value,
                    type_specific_fields: {} // Reset specific fields when type changes
                  })}
                >
                  <SelectTrigger data-testid="public-case-type-select">
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fly_tipping">Fly Tipping / Illegal Dumping</SelectItem>
                    <SelectItem value="abandoned_vehicle">Abandoned Vehicle</SelectItem>
                    <SelectItem value="littering">Littering</SelectItem>
                    <SelectItem value="dog_fouling">Dog Fouling</SelectItem>
                    <SelectItem value="pspo_dog_control">PSPO / Dog Control Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Describe the issue *</Label>
                <Textarea
                  id="description"
                  placeholder="Please provide as much detail as possible about what you've seen..."
                  value={report.description}
                  onChange={(e) => setReport({ ...report, description: e.target.value })}
                  rows={4}
                  data-testid="public-description-input"
                />
              </div>

              {/* Location */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location *
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postcode" className="text-sm text-[#505A5F]">Postcode</Label>
                    <Input
                      id="postcode"
                      placeholder="e.g. SW1A 1AA"
                      value={report.location.postcode}
                      onChange={(e) => setReport({
                        ...report,
                        location: { ...report.location, postcode: e.target.value.toUpperCase() }
                      })}
                      data-testid="public-postcode-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm text-[#505A5F]">Street/Address</Label>
                    <Input
                      id="address"
                      placeholder="Street name or nearby landmark"
                      value={report.location.address}
                      onChange={(e) => setReport({
                        ...report,
                        location: { ...report.location, address: e.target.value }
                      })}
                      data-testid="public-address-input"
                    />
                  </div>
                </div>
              </div>

              {/* Photos */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Photos (Optional)
                </Label>
                <div className="border-2 border-dashed border-gray-200 rounded-sm p-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                    data-testid="public-photo-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    data-testid="public-upload-photo-btn"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Add Photos
                  </Button>
                  <p className="text-xs text-[#505A5F] text-center mt-2">
                    Photos help us locate and assess the issue. Max 5MB per file.
                  </p>
                </div>
                
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative aspect-square">
                        <img
                          src={photo.preview}
                          alt="Upload preview"
                          className="w-full h-full object-cover rounded-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          data-testid={`remove-photo-${photo.id}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Information */}
              <div className="space-y-4 pt-4 border-t">
                <Label>Your Contact Details (Optional)</Label>
                <p className="text-sm text-[#505A5F]">
                  Providing your details helps us follow up if we need more information.
                  Your information will be kept confidential.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reporter_name" className="text-sm text-[#505A5F]">Name</Label>
                    <Input
                      id="reporter_name"
                      placeholder="Your name"
                      value={report.reporter_name}
                      onChange={(e) => setReport({ ...report, reporter_name: e.target.value })}
                      data-testid="public-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reporter_contact" className="text-sm text-[#505A5F]">
                      Phone or Email
                    </Label>
                    <Input
                      id="reporter_contact"
                      placeholder="How can we contact you?"
                      value={report.reporter_contact}
                      onChange={(e) => setReport({ ...report, reporter_contact: e.target.value })}
                      data-testid="public-contact-input"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full bg-[#005EA5] hover:bg-[#004F8C] h-12"
                disabled={submitting}
                data-testid="public-submit-btn"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-sm">
          <p className="text-sm text-[#0B0C0C]">
            <strong>What happens next?</strong>
          </p>
          <ul className="text-sm text-[#505A5F] mt-2 space-y-1 list-disc list-inside">
            <li>Your report will be reviewed by our enforcement team</li>
            <li>If you provided contact details, we may reach out for more information</li>
            <li>Action will be taken according to our enforcement policy</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PublicReport;
