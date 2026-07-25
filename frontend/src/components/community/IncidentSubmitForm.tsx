/**
 * Incident submission form for community reporting.
 *
 * Provides fields for station, line, category, title, description, time,
 * photo upload, anonymous toggle, and location consent.
 * Client-side validation with Zod is supplementary only — backend validates authoritatively.
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, X, MapPin } from "lucide-react";

import { STATIONS } from "@/data/stations";
import {
  INCIDENT_CATEGORIES,
  MRT_LINES,
  type IncidentCreateRequest,
  type IncidentCategory,
} from "@/types/incident.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// ---------------------------------------------------------------------------
// Zod schema (client-side supplementary validation)
// ---------------------------------------------------------------------------

const incidentFormSchema = z.object({
  stationId: z.string().min(1, "Station is required"),
  lineCode: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  incidentTime: z.string().min(1, "Incident time is required"),
  isAnonymous: z.boolean(),
  locationConsent: z.boolean(),
});

type IncidentFormValues = z.infer<typeof incidentFormSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IncidentSubmitFormProps {
  onSubmit: (data: IncidentCreateRequest) => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sorted station options for dropdown */
const STATION_OPTIONS = STATIONS.map((s) => ({
  value: s.id,
  label: `${s.name} (${s.code})`,
  lines: s.lines,
})).sort((a, b) => a.label.localeCompare(b.label));

/** Get the current datetime-local value (defaults to now) */
function getCurrentDateTimeLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IncidentSubmitForm({
  onSubmit,
  isLoading = false,
}: IncidentSubmitFormProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [gpsAvailable, setGpsAvailable] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      stationId: "",
      lineCode: undefined,
      category: "",
      title: "",
      description: "",
      incidentTime: getCurrentDateTimeLocal(),
      isAnonymous: false,
      locationConsent: false,
    },
  });

  const selectedStationId = form.watch("stationId");
  const locationConsent = form.watch("locationConsent");

  // Determine available lines based on selected station
  const availableLines = useMemo(() => {
    if (!selectedStationId) return MRT_LINES;
    const station = STATIONS.find((s) => s.id === selectedStationId);
    if (!station) return MRT_LINES;
    return MRT_LINES.filter((l) => station.lines.includes(l.value));
  }, [selectedStationId]);

  // Check GPS availability
  useEffect(() => {
    if ("geolocation" in navigator) {
      setGpsAvailable(true);
    }
  }, []);

  // Attempt to get location when consent is given
  useEffect(() => {
    if (locationConsent && gpsAvailable) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Failed to get location — reset consent
          setUserLocation(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    } else {
      setUserLocation(null);
    }
  }, [locationConsent, gpsAvailable]);

  // Handle photo selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side preview only — real validation happens on backend
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Form submission
  const handleFormSubmit = (values: IncidentFormValues) => {
    const request: IncidentCreateRequest = {
      stationId: values.stationId,
      lineCode: values.lineCode || undefined,
      category: values.category as IncidentCategory,
      title: values.title,
      description: values.description,
      incidentTime: new Date(values.incidentTime).toISOString(),
      isAnonymous: values.isAnonymous,
      locationConsent: values.locationConsent,
      latitude: values.locationConsent ? userLocation?.lat ?? null : null,
      longitude: values.locationConsent ? userLocation?.lng ?? null : null,
    };

    onSubmit(request);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-5"
      >
        {/* Station selector */}
        <FormField
          control={form.control}
          name="stationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Station *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a station" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {STATION_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Line code selector (optional, contextual) */}
        <FormField
          control={form.control}
          name="lineCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Line (optional)</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a line" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableLines.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category dropdown */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INCIDENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Title input */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Brief summary of the incident"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description textarea */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe what happened in detail (min 10 characters)"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Incident time */}
        <FormField
          control={form.control}
          name="incidentTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Incident Time *</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Photo upload with preview */}
        <div className="space-y-2">
          <Label>Photo (optional)</Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              {photoFile ? "Change photo" : "Add photo"}
            </Button>
            {photoFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removePhoto}
                className="gap-1 text-muted-foreground"
              >
                <X className="h-3 w-3" />
                Remove
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="hidden"
            aria-label="Upload incident photo"
          />
          {photoPreview && (
            <div className="mt-2 relative inline-block">
              <img
                src={photoPreview}
                alt="Incident photo preview"
                className="max-h-48 rounded-md border object-cover"
              />
            </div>
          )}
        </div>

        {/* Anonymous toggle */}
        <FormField
          control={form.control}
          name="isAnonymous"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-medium">
                  Post anonymously
                </FormLabel>
                <p className="text-xs text-muted-foreground">
                  Your identity will be hidden from other users
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Location consent checkbox (only shown if GPS available) */}
        {gpsAvailable && (
          <FormField
            control={form.control}
            name="locationConsent"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3 rounded-lg border p-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                </FormControl>
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Attach my current location
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Your GPS coordinates will be included with this report.
                    This helps verify the incident location.
                  </p>
                  {locationConsent && userLocation && (
                    <p className="text-xs text-green-600">
                      Location acquired ({userLocation.lat.toFixed(4)},{" "}
                      {userLocation.lng.toFixed(4)})
                    </p>
                  )}
                  {locationConsent && !userLocation && (
                    <p className="text-xs text-amber-600">
                      Acquiring location...
                    </p>
                  )}
                </div>
              </FormItem>
            )}
          />
        )}

        {/* Submit button */}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Submitting..." : "Submit Report"}
        </Button>
      </form>
    </Form>
  );
}
