import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// Field configurations for each case type
const WASTE_TYPES = [
  { value: 'household', label: 'Household Waste' },
  { value: 'commercial', label: 'Commercial Waste' },
  { value: 'construction', label: 'Construction Waste' },
  { value: 'mixed', label: 'Mixed Waste' },
  { value: 'unknown', label: 'Unknown' },
];

const TAX_MOT_STATUS = [
  { value: 'taxed', label: 'Taxed' },
  { value: 'untaxed', label: 'Untaxed' },
  { value: 'valid', label: 'Valid' },
  { value: 'expired', label: 'Expired' },
  { value: 'unknown', label: 'Unknown' },
];

const VEHICLE_CONDITIONS = [
  { value: 'good', label: 'Good Condition' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'vandalised', label: 'Vandalised' },
  { value: 'burnt_out', label: 'Burnt Out' },
  { value: 'unknown', label: 'Unknown' },
];

const LITTER_TYPES = [
  { value: 'cigarette_end', label: 'Cigarette End' },
  { value: 'food_packaging', label: 'Food Packaging' },
  { value: 'general_waste', label: 'General Waste' },
  { value: 'other', label: 'Other' },
];

const PSPO_BREACH_TYPES = [
  { value: 'dogs_off_lead', label: 'Dogs Off Lead' },
  { value: 'dog_exclusion_zone', label: 'Dog Exclusion Zone' },
  { value: 'failure_to_pick_up', label: 'Failure to Pick Up' },
  { value: 'exceeding_dog_limit', label: 'Exceeding Dog Limit' },
  { value: 'other', label: 'Other' },
];

const YES_NO_UNKNOWN = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
];

// Fly Tipping Fields Component
export const FlyTippingFields = ({ data, onChange, readOnly = false }) => {
  const fields = data?.fly_tipping || {};
  
  const updateField = (field, value) => {
    onChange({
      ...data,
      fly_tipping: {
        ...fields,
        [field]: value
      }
    });
  };

  const updateVehicleField = (field, value) => {
    onChange({
      ...data,
      fly_tipping: {
        ...fields,
        vehicle_details: {
          ...(fields.vehicle_details || {}),
          [field]: value
        }
      }
    });
  };

  return (
    <Card className="border mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Fly Tipping Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Description of Waste</Label>
          <Textarea
            placeholder="Describe the waste found..."
            value={fields.waste_description || ''}
            onChange={(e) => updateField('waste_description', e.target.value)}
            disabled={readOnly}
            data-testid="fly-tipping-waste-description"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Estimated Quantity/Size</Label>
            <Input
              placeholder="e.g., 2 cubic metres, 10 bags"
              value={fields.estimated_quantity || ''}
              onChange={(e) => updateField('estimated_quantity', e.target.value)}
              disabled={readOnly}
              data-testid="fly-tipping-quantity"
            />
          </div>
          <div className="space-y-2">
            <Label>Waste Type</Label>
            <Select
              value={fields.waste_type || ''}
              onValueChange={(v) => updateField('waste_type', v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="fly-tipping-waste-type">
                <SelectValue placeholder="Select waste type" />
              </SelectTrigger>
              <SelectContent>
                {WASTE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <Label>Were any offenders witnessed or identified?</Label>
          <Switch
            checked={fields.offender_witnessed || false}
            onCheckedChange={(v) => updateField('offender_witnessed', v)}
            disabled={readOnly}
            data-testid="fly-tipping-offender-witnessed"
          />
        </div>

        {fields.offender_witnessed && (
          <div className="space-y-4 pl-4 border-l-2 border-blue-200">
            <div className="space-y-2">
              <Label>Offender Description</Label>
              <Textarea
                placeholder="Describe the offender(s)..."
                value={fields.offender_description || ''}
                onChange={(e) => updateField('offender_description', e.target.value)}
                disabled={readOnly}
                data-testid="fly-tipping-offender-description"
              />
            </div>

            <p className="text-sm font-medium text-[#505A5F]">Vehicle Details (if applicable)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Registration</Label>
                <Input
                  placeholder="e.g., AB12 CDE"
                  value={fields.vehicle_details?.registration_number || ''}
                  onChange={(e) => updateVehicleField('registration_number', e.target.value.toUpperCase())}
                  disabled={readOnly}
                  data-testid="fly-tipping-vehicle-reg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Make</Label>
                <Input
                  placeholder="e.g., Ford"
                  value={fields.vehicle_details?.make || ''}
                  onChange={(e) => updateVehicleField('make', e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Model</Label>
                <Input
                  placeholder="e.g., Transit"
                  value={fields.vehicle_details?.model || ''}
                  onChange={(e) => updateVehicleField('model', e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Colour</Label>
                <Input
                  placeholder="e.g., White"
                  value={fields.vehicle_details?.colour || ''}
                  onChange={(e) => updateVehicleField('colour', e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Any identifying evidence found? (documents, labels, etc.)</Label>
          <Textarea
            placeholder="Describe any evidence that may identify the source..."
            value={fields.identifying_evidence || ''}
            onChange={(e) => updateField('identifying_evidence', e.target.value)}
            disabled={readOnly}
            data-testid="fly-tipping-evidence"
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Abandoned Vehicle Fields Component
export const AbandonedVehicleFields = ({ data, onChange, readOnly = false }) => {
  const fields = data?.abandoned_vehicle || {};
  
  const updateField = (field, value) => {
    onChange({
      ...data,
      abandoned_vehicle: {
        ...fields,
        [field]: value
      }
    });
  };

  return (
    <Card className="border mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Abandoned Vehicle Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Registration Number *</Label>
            <Input
              placeholder="e.g., AB12 CDE"
              value={fields.registration_number || ''}
              onChange={(e) => updateField('registration_number', e.target.value.toUpperCase())}
              disabled={readOnly}
              data-testid="abandoned-vehicle-reg"
            />
          </div>
          <div className="space-y-2">
            <Label>Make</Label>
            <Input
              placeholder="e.g., Ford"
              value={fields.make || ''}
              onChange={(e) => updateField('make', e.target.value)}
              disabled={readOnly}
              data-testid="abandoned-vehicle-make"
            />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              placeholder="e.g., Focus"
              value={fields.model || ''}
              onChange={(e) => updateField('model', e.target.value)}
              disabled={readOnly}
              data-testid="abandoned-vehicle-model"
            />
          </div>
          <div className="space-y-2">
            <Label>Colour</Label>
            <Input
              placeholder="e.g., Blue"
              value={fields.colour || ''}
              onChange={(e) => updateField('colour', e.target.value)}
              disabled={readOnly}
              data-testid="abandoned-vehicle-colour"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tax Status</Label>
            <Select
              value={fields.tax_status || ''}
              onValueChange={(v) => updateField('tax_status', v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="abandoned-vehicle-tax">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="taxed">Taxed</SelectItem>
                <SelectItem value="untaxed">Untaxed</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>MOT Status</Label>
            <Select
              value={fields.mot_status || ''}
              onValueChange={(v) => updateField('mot_status', v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="abandoned-vehicle-mot">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vehicle Condition</Label>
            <Select
              value={fields.condition || ''}
              onValueChange={(v) => updateField('condition', v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="abandoned-vehicle-condition">
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_CONDITIONS.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Estimated Time at Location</Label>
            <Input
              placeholder="e.g., 2 weeks, Several months"
              value={fields.estimated_time_at_location || ''}
              onChange={(e) => updateField('estimated_time_at_location', e.target.value)}
              disabled={readOnly}
              data-testid="abandoned-vehicle-time"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-sm">
            <Label>Is the vehicle causing an obstruction or danger?</Label>
            <Switch
              checked={fields.causing_obstruction || false}
              onCheckedChange={(v) => updateField('causing_obstruction', v)}
              disabled={readOnly}
              data-testid="abandoned-vehicle-obstruction"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Littering Fields Component
export const LitteringFields = ({ data, onChange, readOnly = false }) => {
  const fields = data?.littering || {};
  
  const updateField = (field, value) => {
    onChange({
      ...data,
      littering: {
        ...fields,
        [field]: value
      }
    });
  };

  return (
    <Card className="border mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Littering Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Type of Litter</Label>
          <Select
            value={fields.litter_type || ''}
            onValueChange={(v) => updateField('litter_type', v)}
            disabled={readOnly}
          >
            <SelectTrigger data-testid="littering-type">
              <SelectValue placeholder="Select litter type" />
            </SelectTrigger>
            <SelectContent>
              {LITTER_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label>Was the offence witnessed?</Label>
          <Switch
            checked={fields.offence_witnessed || false}
            onCheckedChange={(v) => updateField('offence_witnessed', v)}
            disabled={readOnly}
            data-testid="littering-witnessed"
          />
        </div>

        {fields.offence_witnessed && (
          <div className="space-y-4 pl-4 border-l-2 border-blue-200">
            <div className="space-y-2">
              <Label>Offender Description</Label>
              <Textarea
                placeholder="Describe the offender..."
                value={fields.offender_description || ''}
                onChange={(e) => updateField('offender_description', e.target.value)}
                disabled={readOnly}
                data-testid="littering-offender-description"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Any supporting evidence available? (photos, notes, statements)</Label>
          <Textarea
            placeholder="Describe any supporting evidence..."
            value={fields.supporting_evidence || ''}
            onChange={(e) => updateField('supporting_evidence', e.target.value)}
            disabled={readOnly}
            data-testid="littering-evidence"
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Dog Fouling Fields Component
export const DogFoulingFields = ({ data, onChange, readOnly = false }) => {
  const fields = data?.dog_fouling || {};
  
  const updateField = (field, value) => {
    onChange({
      ...data,
      dog_fouling: {
        ...fields,
        [field]: value
      }
    });
  };

  return (
    <Card className="border mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dog Fouling Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date and Time of Occurrence</Label>
            <Input
              type="datetime-local"
              value={fields.occurrence_datetime || ''}
              onChange={(e) => updateField('occurrence_datetime', e.target.value)}
              disabled={readOnly}
              data-testid="dog-fouling-datetime"
            />
          </div>
          <div className="space-y-2">
            <Label>Is this a repeat/regular occurrence at this location?</Label>
            <Select
              value={fields.repeat_occurrence || ''}
              onValueChange={(v) => updateField('repeat_occurrence', v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="dog-fouling-repeat">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {YES_NO_UNKNOWN.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />
        <p className="text-sm font-medium text-[#505A5F]">Offender Information (if known)</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Description of Person</Label>
            <Textarea
              placeholder="Describe the person..."
              value={fields.offender_description || ''}
              onChange={(e) => updateField('offender_description', e.target.value)}
              disabled={readOnly}
              rows={2}
              data-testid="dog-fouling-offender"
            />
          </div>
          <div className="space-y-2">
            <Label>Description of Dog(s)</Label>
            <Textarea
              placeholder="Describe the dog(s)..."
              value={fields.dog_description || ''}
              onChange={(e) => updateField('dog_description', e.target.value)}
              disabled={readOnly}
              rows={2}
              data-testid="dog-fouling-dog"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Any Additional Information</Label>
          <Textarea
            placeholder="Any other relevant details..."
            value={fields.additional_info || ''}
            onChange={(e) => updateField('additional_info', e.target.value)}
            disabled={readOnly}
            data-testid="dog-fouling-additional"
          />
        </div>
      </CardContent>
    </Card>
  );
};

// PSPO Enforcement Fields Component
export const PSPOFields = ({ data, onChange, readOnly = false }) => {
  const fields = data?.pspo_dog_control || {};
  
  const updateField = (field, value) => {
    onChange({
      ...data,
      pspo_dog_control: {
        ...fields,
        [field]: value
      }
    });
  };

  return (
    <Card className="border mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">PSPO Enforcement Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nature of PSPO Breach</Label>
            <Select
              value={fields.breach_nature || ''}
              onValueChange={(v) => updateField('breach_nature', v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="pspo-breach-nature">
                <SelectValue placeholder="Select breach type" />
              </SelectTrigger>
              <SelectContent>
                {PSPO_BREACH_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Signage Present at Location?</Label>
            <Select
              value={fields.signage_present || ''}
              onValueChange={(v) => updateField('signage_present', v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="pspo-signage">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {YES_NO_UNKNOWN.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Location Within PSPO Area</Label>
          <Input
            placeholder="e.g., Near playground, Main entrance of park"
            value={fields.location_within_area || ''}
            onChange={(e) => updateField('location_within_area', e.target.value)}
            disabled={readOnly}
            data-testid="pspo-location"
          />
        </div>

        <div className="space-y-2">
          <Label>Any Exemptions Claimed or Applicable?</Label>
          <Textarea
            placeholder="Detail any exemptions claimed by the offender or applicable exemptions..."
            value={fields.exemptions_claimed || ''}
            onChange={(e) => updateField('exemptions_claimed', e.target.value)}
            disabled={readOnly}
            data-testid="pspo-exemptions"
          />
        </div>

        <div className="space-y-2">
          <Label>Officer Notes</Label>
          <Textarea
            placeholder="Additional observations and notes..."
            value={fields.officer_notes || ''}
            onChange={(e) => updateField('officer_notes', e.target.value)}
            disabled={readOnly}
            rows={3}
            data-testid="pspo-notes"
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Main component that renders the appropriate fields based on case type
export const CaseTypeFields = ({ caseType, data, onChange, readOnly = false }) => {
  if (!caseType) return null;

  const fieldComponents = {
    fly_tipping: FlyTippingFields,
    abandoned_vehicle: AbandonedVehicleFields,
    littering: LitteringFields,
    dog_fouling: DogFoulingFields,
    pspo_dog_control: PSPOFields,
  };

  const FieldComponent = fieldComponents[caseType];
  
  if (!FieldComponent) return null;

  return <FieldComponent data={data} onChange={onChange} readOnly={readOnly} />;
};

export default CaseTypeFields;
