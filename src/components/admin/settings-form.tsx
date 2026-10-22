"use client";

import { Minus, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import type { AdminSettings } from "@/features/clinic-settings/repository";
import { WEEKDAYS, type Weekday } from "@/features/clinic-settings/types";

import { useAdminRequest } from "./use-admin-request";

const DAY_LABELS: Record<Weekday, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

type Interval = { open: string; close: string };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-md border border-silver-200 bg-white p-5">
      <legend className="px-1 text-lg font-semibold">{title}</legend>
      {description ? <p className="text-sm text-graphite-600">{description}</p> : null}
      {children}
    </fieldset>
  );
}

const blank = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
};

/** Owner-only clinic settings. Saved with the version number so concurrent edits are detected. */
export function SettingsForm({ initial }: { initial: AdminSettings }) {
  const { send, pending, error } = useAdminRequest();
  const [version, setVersion] = useState(initial.version);
  const [hours, setHours] = useState<Record<Weekday, Interval[]>>(() => Object.fromEntries(WEEKDAYS.map((d) => [d, [...initial.weeklyHours[d]]])) as Record<Weekday, Interval[]>);
  const [saved, setSaved] = useState(false);

  function setInterval(day: Weekday, index: number, key: keyof Interval, value: string) {
    setHours((h) => ({ ...h, [day]: h[day].map((iv, i) => (i === index ? { ...iv, [key]: value } : iv)) }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const f = new FormData(event.currentTarget);
    const staffEmails = String(f.get("staffEmails") ?? "")
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const changes = {
      clinicName: blank(f.get("clinicName")),
      doctorName: blank(f.get("doctorName")),
      doctorCredentials: String(f.get("doctorCredentials") ?? "").trim(),
      doctorRegistrationNo: String(f.get("doctorRegistrationNo") ?? "").trim(),
      phoneE164: blank(f.get("phoneE164")),
      whatsappEnabled: f.get("whatsappEnabled") === "on",
      whatsappE164: blank(f.get("whatsappE164")),
      email: blank(f.get("email")),
      address: {
        line1: blank(f.get("line1")),
        line2: blank(f.get("line2")),
        locality: blank(f.get("locality")),
        district: blank(f.get("district")),
        state: blank(f.get("state")),
        postalCode: blank(f.get("postalCode")),
        country: "IN",
      },
      mapUrl: blank(f.get("mapUrl")),
      googleBusinessProfileUrl: blank(f.get("googleBusinessProfileUrl")),
      social: { facebook: blank(f.get("facebook")), instagram: blank(f.get("instagram")), youtube: blank(f.get("youtube")), x: blank(f.get("x")) },
      weeklyHours: hours,
      slotMinutes: Number(f.get("slotMinutes")),
      capacity: Number(f.get("capacity")),
      minNoticeMinutes: Math.round(Number(f.get("minNoticeHours")) * 60),
      maxAdvanceDays: Number(f.get("maxAdvanceDays")),
      bookingMode: f.get("bookingMode"),
      bookingEnabled: f.get("bookingEnabled") === "on",
      notifications: {
        staffEmails,
        patientAck: f.get("patientAck") === "on",
        patientStatusEmails: f.get("patientStatusEmails") === "on",
        staffNewBooking: f.get("staffNewBooking") === "on",
        staffNewEnquiry: f.get("staffNewEnquiry") === "on",
      },
      policies: {
        cancellationText: String(f.get("cancellationText") ?? ""),
        retentionMonthsAppointments: Number(f.get("retentionMonthsAppointments")),
        retentionMonthsEnquiries: Number(f.get("retentionMonthsEnquiries")),
      },
      legalPagesApproved: f.get("legalPagesApproved") === "on",
    };
    const result = await send<AdminSettings>("/api/admin/settings", "PATCH", { version, changes });
    if (result.ok) {
      setVersion(result.data.version);
      setSaved(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const fieldErrors = Object.entries(error?.fields ?? {});

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {saved ? <Alert kind="success" title="Settings saved. The public website now shows the new details." live /> : null}
      {error ? (
        <Alert kind="error" title={error.code === "VERSION_CONFLICT" ? "Someone else changed the settings. Reload the page to see their changes, then try again." : error.message} live>
          {fieldErrors.length ? (
            <ul className="list-disc pl-5">
              {fieldErrors.map(([field, message]) => (
                <li key={field}>
                  <span className="font-mono text-xs">{field.replace(/^changes\./, "")}</span>: {message}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <Section title="Clinic and doctor" description="Only enter details that have been verified. Empty fields are not shown on the website.">
        <div className="grid gap-4 md:grid-cols-2">
          <InputField id="s-clinicName" name="clinicName" label="Clinic name" defaultValue={initial.clinicName} required />
          <InputField id="s-doctorName" name="doctorName" label="Doctor name" defaultValue={initial.doctorName} required />
          <InputField id="s-doctorCredentials" name="doctorCredentials" label="Qualifications" optional hint="For example BDS, MDS (as on the registration certificate)." defaultValue={initial.doctorCredentials} />
          <InputField id="s-doctorRegistrationNo" name="doctorRegistrationNo" label="Dental council registration number" optional defaultValue={initial.doctorRegistrationNo} />
        </div>
      </Section>

      <Section title="Contact and location">
        <div className="grid gap-4 md:grid-cols-2">
          <InputField id="s-phone" name="phoneE164" label="Booking phone (+91 format)" defaultValue={initial.phoneE164} required />
          <InputField id="s-email" name="email" label="Clinic email" type="email" optional defaultValue={initial.email} />
          <CheckboxField id="s-whatsappEnabled" name="whatsappEnabled" label="Show WhatsApp buttons (only if the clinic uses WhatsApp)" defaultChecked={initial.whatsappEnabled} />
          <InputField id="s-whatsapp" name="whatsappE164" label="WhatsApp number" optional hint="Leave empty to use the booking phone." defaultValue={initial.whatsappE164} />
          <InputField id="s-line1" name="line1" label="Address line 1" defaultValue={initial.address.line1} required />
          <InputField id="s-line2" name="line2" label="Address line 2" optional defaultValue={initial.address.line2} />
          <InputField id="s-locality" name="locality" label="Town / locality" defaultValue={initial.address.locality} required />
          <InputField id="s-district" name="district" label="District" defaultValue={initial.address.district} required />
          <InputField id="s-state" name="state" label="State" defaultValue={initial.address.state} required />
          <InputField id="s-postal" name="postalCode" label="PIN code" optional defaultValue={initial.address.postalCode} />
          <InputField id="s-map" name="mapUrl" label="Google Maps link" optional hint="Share link of the clinic's verified map pin (https://…)." defaultValue={initial.mapUrl} />
          <InputField id="s-gbp" name="googleBusinessProfileUrl" label="Google Business Profile link" optional defaultValue={initial.googleBusinessProfileUrl} />
          <InputField id="s-facebook" name="facebook" label="Facebook page" optional defaultValue={initial.social.facebook} />
          <InputField id="s-instagram" name="instagram" label="Instagram" optional defaultValue={initial.social.instagram} />
          <InputField id="s-youtube" name="youtube" label="YouTube" optional defaultValue={initial.social.youtube} />
          <InputField id="s-x" name="x" label="X (Twitter)" optional defaultValue={initial.social.x} />
        </div>
      </Section>

      <Section title="Opening hours" description="Add one or more time ranges per day; gaps between ranges are breaks. A day with no ranges is closed. Online booking only opens once at least one day has hours.">
        <div className="space-y-3">
          {WEEKDAYS.map((day) => (
            <div key={day} className="grid gap-2 border-b border-silver-200 pb-3 md:grid-cols-[8rem_1fr]">
              <p className="pt-2 font-semibold">{DAY_LABELS[day]}</p>
              <div className="space-y-2">
                {hours[day].length === 0 ? <p className="pt-2 text-sm text-graphite-600">Closed</p> : null}
                {hours[day].map((iv, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`h-${day}-${i}-open`}>
                      {DAY_LABELS[day]} range {i + 1} opens
                    </label>
                    <input id={`h-${day}-${i}-open`} type="time" value={iv.open} onChange={(e) => setInterval(day, i, "open", e.target.value)} className="min-h-11 rounded-sm border border-steel-400 px-2" />
                    <span aria-hidden="true">to</span>
                    <label className="sr-only" htmlFor={`h-${day}-${i}-close`}>
                      {DAY_LABELS[day]} range {i + 1} closes
                    </label>
                    <input id={`h-${day}-${i}-close`} type="time" value={iv.close} onChange={(e) => setInterval(day, i, "close", e.target.value)} className="min-h-11 rounded-sm border border-steel-400 px-2" />
                    <button
                      type="button"
                      onClick={() => setHours((h) => ({ ...h, [day]: h[day].filter((_, j) => j !== i) }))}
                      className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm hover:bg-ink-900/5"
                    >
                      <Minus aria-hidden="true" className="size-4" /> Remove<span className="sr-only"> {DAY_LABELS[day]} range {i + 1}</span>
                    </button>
                  </div>
                ))}
                {hours[day].length < 4 ? (
                  <button
                    type="button"
                    onClick={() => setHours((h) => ({ ...h, [day]: [...h[day], { open: "10:00", close: "13:00" }] }))}
                    className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold hover:bg-ink-900/5"
                  >
                    <Plus aria-hidden="true" className="size-4" /> Add time range<span className="sr-only"> for {DAY_LABELS[day]}</span>
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Online booking rules">
        <div className="grid gap-4 md:grid-cols-2">
          <CheckboxField id="s-bookingEnabled" name="bookingEnabled" label="Accept online appointment requests" defaultChecked={initial.bookingEnabled} />
          <SelectField id="s-bookingMode" name="bookingMode" label="Booking mode" defaultValue={initial.bookingMode}>
            <option value="request">Request – staff confirm each appointment (recommended)</option>
            <option value="instant">Instant – the slot is confirmed automatically</option>
          </SelectField>
          <SelectField id="s-slot" name="slotMinutes" label="Appointment length" defaultValue={String(initial.slotMinutes)}>
            {[10, 15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </SelectField>
          <SelectField id="s-capacity" name="capacity" label="Patients at the same time (chairs)" defaultValue={String(initial.capacity)}>
            {[1, 2, 3, 4, 5].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
          <InputField id="s-notice" name="minNoticeHours" label="Minimum notice (hours)" type="number" min={0} max={168} step={0.5} defaultValue={initial.minNoticeMinutes / 60} />
          <InputField id="s-advance" name="maxAdvanceDays" label="How far ahead patients can book (days)" type="number" min={1} max={180} defaultValue={initial.maxAdvanceDays} />
        </div>
      </Section>

      <Section title="Notifications" description="Emails are only sent once the email provider is set up.">
        <TextareaField id="s-staffEmails" name="staffEmails" label="Staff alert emails" hint="Up to 5 addresses, one per line." defaultValue={initial.notifications.staffEmails.join("\n")} />
        <div className="grid gap-2 md:grid-cols-2">
          <CheckboxField id="s-staffNewBooking" name="staffNewBooking" label="Alert staff about new appointment requests" defaultChecked={initial.notifications.staffNewBooking} />
          <CheckboxField id="s-staffNewEnquiry" name="staffNewEnquiry" label="Alert staff about new enquiries" defaultChecked={initial.notifications.staffNewEnquiry} />
          <CheckboxField id="s-patientAck" name="patientAck" label="Email patients a copy of their request" defaultChecked={initial.notifications.patientAck} />
          <CheckboxField id="s-patientStatus" name="patientStatusEmails" label="Email patients when their appointment is confirmed, moved or cancelled" defaultChecked={initial.notifications.patientStatusEmails} />
        </div>
      </Section>

      <Section title="Policies and legal pages">
        <TextareaField id="s-cancellation" name="cancellationText" label="Cancellation policy" optional maxLength={1000} defaultValue={initial.policies.cancellationText} />
        <div className="grid gap-4 md:grid-cols-2">
          <InputField id="s-retA" name="retentionMonthsAppointments" label="Keep appointment records (months)" type="number" min={1} max={120} defaultValue={initial.policies.retentionMonthsAppointments} />
          <InputField id="s-retE" name="retentionMonthsEnquiries" label="Keep enquiries (months)" type="number" min={1} max={120} defaultValue={initial.policies.retentionMonthsEnquiries} />
        </div>
        <CheckboxField
          id="s-legal"
          name="legalPagesApproved"
          label="The clinic has reviewed and approved the Privacy Policy and Terms of Use (removes the draft notice and allows search engines to index them)"
          defaultChecked={initial.legalPagesApproved}
        />
      </Section>

      <div className="sticky bottom-0 flex items-center gap-4 border-t border-silver-200 bg-paper-50 py-4">
        <Button type="submit" size="lg" loading={pending}>
          Save settings
        </Button>
        <span className="text-sm text-graphite-600">Version {version}</span>
      </div>
    </form>
  );
}
