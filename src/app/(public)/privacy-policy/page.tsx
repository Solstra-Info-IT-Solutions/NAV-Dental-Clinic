import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal/legal-page";
import { addressOneLine, formatPhoneDisplay } from "@/features/clinic-settings/format";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  // Drafts are kept out of search results until the clinic approves them.
  return pageMetadata({
    title: "Privacy Policy",
    description: "How NAV Dental Clinic collects, uses and protects information submitted through this website.",
    path: "/privacy-policy",
    noindex: !settings.legalPagesApproved,
  });
}

export default async function PrivacyPolicyPage() {
  const settings = await getPublicSettings();
  const phone = formatPhoneDisplay(settings.phoneE164);

  return (
    <LegalPage title="Privacy Policy" href="/privacy-policy" approved={settings.legalPagesApproved}>
      <h2>Who we are</h2>
      <p>
        This website is operated by {settings.clinicName}, {addressOneLine(settings.address)}. In this policy, &ldquo;we&rdquo; and
        &ldquo;the clinic&rdquo; mean {settings.clinicName}.
      </p>

      <h2>Information we collect</h2>
      <p>We only collect information you choose to send us through this website:</p>
      <ul>
        <li>
          <strong>Appointment requests:</strong> your name, mobile number, optional email address, the type of visit, your preferred
          date and time, and an optional short message.
        </li>
        <li>
          <strong>Contact enquiries:</strong> your name, mobile number, optional email address, the subject of your enquiry and your
          message.
        </li>
        <li>
          <strong>Technical information:</strong> to protect the website from abuse, we process your IP address in a one-way
          scrambled (hashed) form for rate limiting. We do not use advertising or tracking cookies.
        </li>
      </ul>
      <p>
        Please do not send detailed medical history or records through the website. You can discuss your health with the dentist at
        your visit.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To review, confirm, reschedule or cancel your appointment and to contact you about it.</li>
        <li>To reply to your enquiry.</li>
        <li>To send you messages about your appointment by email, where you have given an email address.</li>
        <li>To keep the website secure and prevent spam and misuse.</li>
      </ul>
      <p>
        We will only send you other communications if you separately agree to receive them. Agreeing is optional and does not affect
        your appointment.
      </p>

      <h2>Who processes your information</h2>
      <p>
        Your information is accessed by authorised clinic staff. We use service providers for website hosting, database storage and
        email delivery, who process information on our behalf only to provide those services. The list of providers will be published
        here before launch.
      </p>
      <p>We do not sell your information.</p>

      <h2>How long we keep it</h2>
      <p>
        Appointment records and enquiries are kept only as long as needed for the purposes above. The retention periods will be
        confirmed by the clinic and stated here before launch.
      </p>

      <h2>Your choices and requests</h2>
      <p>
        You can ask to see, correct or delete the information you submitted through this website, or withdraw optional consent, by
        calling the clinic on {phone}. We may need to confirm your identity before acting on a request.
      </p>

      <h2>How we protect it</h2>
      <p>
        The website uses encrypted connections (HTTPS). Access to appointment and enquiry records is restricted to authorised staff
        who must sign in, and actions on records are logged.
      </p>

      <h2>Changes to this policy</h2>
      <p>If we change this policy, we will update this page and the date below.</p>

      <h2>Contact</h2>
      <p>
        For privacy questions, call {phone} or write to {settings.clinicName}, {addressOneLine(settings.address)}. See also our{" "}
        <Link href="/terms">Terms of Use</Link>.
      </p>
      <p>
        <strong>Last updated:</strong> draft, not yet in effect.
      </p>
    </LegalPage>
  );
}
