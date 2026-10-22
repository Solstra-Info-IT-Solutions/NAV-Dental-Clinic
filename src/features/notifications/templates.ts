/**
 * Plain, honest notification copy. Request-mode emails never say the
 * appointment is confirmed. Every value is HTML-escaped.
 */
import { formatPhoneDisplay } from "@/features/clinic-settings/format";
import { formatLocalDate, formatLocalTime } from "@/lib/time/ist";

export type AppointmentEvent = "received" | "confirmed" | "rescheduled" | "cancelled" | "rejected";

export type TemplateAppointment = {
  reference: string;
  serviceTitle: string;
  start: Date;
  status: string;
  patientName: string;
  patientPhoneE164: string;
  message?: string;
  source: string;
};

export type TemplateClinic = { clinicName: string; phoneE164: string; addressLine: string };

export type RenderedEmail = { subject: string; text: string; html: string };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function render(subject: string, paragraphs: string[], clinic: TemplateClinic): RenderedEmail {
  const footer = `${clinic.clinicName}, ${clinic.addressLine}. Phone ${formatPhoneDisplay(clinic.phoneE164)}.`;
  const text = [...paragraphs, "", footer].join("\n\n");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#131313;line-height:1.6;max-width:560px">${paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("")}<hr style="border:0;border-top:1px solid #d0d0d0"><p style="color:#4a4a4a;font-size:13px">${escapeHtml(footer)}</p></body></html>`;
  return { subject, text, html };
}

function when(a: TemplateAppointment): string {
  return `${formatLocalDate(a.start)} at ${formatLocalTime(a.start)}`;
}

export function patientAppointmentEmail(event: AppointmentEvent, a: TemplateAppointment, clinic: TemplateClinic): RenderedEmail {
  const phone = formatPhoneDisplay(clinic.phoneE164);
  const details = `Reference: ${a.reference}\nVisit: ${a.serviceTitle}\nRequested time: ${when(a)}`;
  switch (event) {
    case "received":
      return a.status === "confirmed"
        ? render(`Appointment booked – ${a.reference}`, [`Dear ${a.patientName},`, `Your appointment at ${clinic.clinicName} is booked.`, details, `To change or cancel, please call ${phone}.`], clinic)
        : render(
            `We received your appointment request – ${a.reference}`,
            [
              `Dear ${a.patientName},`,
              `Thank you for your appointment request. This is not yet a confirmed appointment: the clinic will contact you on your mobile number to confirm the time.`,
              details,
              `If you need to change or cancel your request, please call ${phone}.`,
            ],
            clinic,
          );
    case "confirmed":
      return render(`Appointment confirmed – ${a.reference}`, [`Dear ${a.patientName},`, `Your appointment is confirmed.`, details.replace("Requested time", "Time"), `To change or cancel, please call ${phone}.`], clinic);
    case "rescheduled":
      return render(`Appointment time changed – ${a.reference}`, [`Dear ${a.patientName},`, `Your appointment has been moved to a new time.`, details.replace("Requested time", "New time"), `If this time does not suit you, please call ${phone}.`], clinic);
    case "cancelled":
      return render(`Appointment cancelled – ${a.reference}`, [`Dear ${a.patientName},`, `Your appointment for ${when(a)} has been cancelled.`, `To book another time, please call ${phone}.`], clinic);
    case "rejected":
      return render(`About your appointment request – ${a.reference}`, [`Dear ${a.patientName},`, `Unfortunately the clinic cannot offer the time you requested (${when(a)}).`, `Please call ${phone} and the team will help you find another time.`], clinic);
  }
}

/** Internal alert for clinic staff. Contains only what staff need to call the patient back. */
export function staffNewAppointmentEmail(a: TemplateAppointment, clinic: TemplateClinic, adminUrl: string): RenderedEmail {
  return render(
    `New appointment request ${a.reference} – ${formatLocalDate(a.start)} ${formatLocalTime(a.start)}`,
    [
      `A new appointment ${a.status === "confirmed" ? "booking" : "request"} was submitted online.`,
      `Reference: ${a.reference}\nPatient: ${a.patientName}\nMobile: ${formatPhoneDisplay(a.patientPhoneE164)}\nVisit: ${a.serviceTitle}\nTime: ${when(a)}`,
      a.message ? `Patient message: ${a.message}` : "",
      a.status === "confirmed" ? "This booking was confirmed automatically." : "Please review it and contact the patient to confirm.",
      `Open the admin dashboard: ${adminUrl}`,
    ].filter(Boolean),
    clinic,
  );
}
