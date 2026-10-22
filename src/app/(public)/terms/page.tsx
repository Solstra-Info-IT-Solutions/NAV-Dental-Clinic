import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal/legal-page";
import { formatPhoneDisplay } from "@/features/clinic-settings/format";
import { getPublicSettings } from "@/features/clinic-settings/queries";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  return {
    title: "Terms of Use",
    description: "Terms for using the NAV Dental Clinic website and requesting appointments online.",
    robots: settings.legalPagesApproved ? undefined : { index: false, follow: true },
  };
}

export default async function TermsPage() {
  const settings = await getPublicSettings();
  const phone = formatPhoneDisplay(settings.phoneE164);

  return (
    <LegalPage title="Terms of Use" href="/terms" approved={settings.legalPagesApproved}>
      <h2>About these terms</h2>
      <p>
        These terms apply to your use of the {settings.clinicName} website. By using the website you agree to them. If you do not
        agree, please do not use the website.
      </p>

      <h2>Information on this website</h2>
      <p>
        Information about dental treatments on this website is general and for information only. It is not a diagnosis, does not
        replace an examination, and is not personal medical advice. Treatment suitability and outcomes vary from person to person
        and can only be discussed after an assessment by the dentist.
      </p>
      <p>
        In an emergency, such as severe swelling, difficulty breathing or swallowing, or heavy bleeding, seek urgent medical care
        immediately. Do not rely on this website or wait for a reply to an online request.
      </p>

      <h2>Appointment requests</h2>
      <ul>
        {settings.bookingMode === "request" ? (
          <li>
            Submitting a request online does not confirm an appointment. Your appointment is confirmed only when the clinic contacts you
            to confirm it.
          </li>
        ) : (
          <li>Online bookings reserve the selected time. The clinic may contact you if a change becomes necessary.</li>
        )}
        <li>Please give accurate contact details so the clinic can reach you.</li>
        <li>
          To reschedule or cancel, please call {phone} as early as possible. The clinic may need to reschedule appointments in
          unavoidable circumstances and will contact you if so.
        </li>
        <li>Fees, if any, are discussed and agreed at the clinic. No payment is taken through this website.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Do not submit false or misleading requests, attempt to access areas of the website that are not public, interfere with its
        operation, or send spam or harmful content.
      </p>

      <h2>Availability</h2>
      <p>
        We aim to keep the website available and accurate but cannot guarantee it will always be uninterrupted or error-free. Time
        slots shown online may change until the clinic confirms them.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle information you submit is explained in our <Link href="/privacy-policy">Privacy Policy</Link>.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms. The version on this page applies from the date shown.</p>

      <h2>Contact</h2>
      <p>Questions about these terms can be directed to the clinic on {phone}.</p>
      <p>
        <strong>Last updated:</strong> draft, not yet in effect.
      </p>
    </LegalPage>
  );
}
