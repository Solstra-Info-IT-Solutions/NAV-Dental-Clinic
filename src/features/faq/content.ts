import { formatPhoneDisplay } from "@/features/clinic-settings/format";
import type { PublicClinicSettings } from "@/features/clinic-settings/types";

export type Faq = { q: string; a: string };

/**
 * General clinic FAQs. Answers are derived from settings so they always match
 * the clinic's configured contact details and booking mode. Wording is a
 * draft for clinic approval.
 */
export function buildGeneralFaqs(settings: PublicClinicSettings): Faq[] {
  const phone = formatPhoneDisplay(settings.phoneE164);
  const whatsapp = settings.whatsappE164 ? ` or send a WhatsApp message to ${formatPhoneDisplay(settings.whatsappE164)}` : "";
  const address = [settings.address.line1, settings.address.line2, settings.address.locality].filter(Boolean).join(", ");

  return [
    {
      q: "How do I request an appointment?",
      a: `Call the clinic on ${phone}${whatsapp}. You can also use the appointment page on this website to send a request once online booking is open.`,
    },
    {
      q: "How is my appointment confirmed?",
      a:
        settings.bookingMode === "request"
          ? "An online request is not a confirmed appointment. The clinic team reviews each request and contacts you on the mobile number you provide to confirm the date and time."
          : "When online booking confirms your slot, you receive a booking reference. The clinic may still contact you if anything needs to change.",
    },
    {
      q: "How can I reschedule or cancel?",
      a: `Please call the clinic on ${phone}${whatsapp} as early as possible and mention your booking reference if you have one, so the time can be offered to another patient.`,
    },
    {
      q: "What information should I provide when booking?",
      a: "Your name, a mobile number we can reach you on, the type of visit you need and your preferred date and time. Please do not send detailed medical records through the website; you can discuss your health with the dentist at your visit.",
    },
    {
      q: "Where is the clinic?",
      a: `${settings.clinicName} is on ${address}. Use the "Get directions" link on the contact page to open the location in Google Maps.`,
    },
    {
      q: "How do I contact the clinic?",
      a: `Phone ${phone}${whatsapp}, or visit the contact page for the address and directions.`,
    },
  ];
}
