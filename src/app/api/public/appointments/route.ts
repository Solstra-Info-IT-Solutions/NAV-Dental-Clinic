import { after } from "next/server";

import { appointmentRequestSchema } from "@/features/appointments/schemas";
import { createWebAppointment } from "@/features/appointments/service";
import { spamReason } from "@/features/appointments/spam";
import { findSettings } from "@/features/clinic-settings/repository";
import { getEmailProvider } from "@/features/notifications/email-provider";
import { notifyAppointmentEvent } from "@/features/notifications/service";
import { assertSameOrigin, clientIp, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { connectToDatabase } from "@/lib/db/connection";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { enforceRateLimit, hashIdentifier, RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * POST /api/public/appointments — create an appointment request.
 * Order: origin → body/schema → spam → rate limits → booking transaction →
 * response; notifications run after the response and never affect it.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request, appointmentRequestSchema);

    const spam = spamReason({ honeypot: body.hp, formStartedAt: body.formStartedAt });
    if (spam) {
      logger.warn("appointment.spam_rejected", { reason: spam });
      throw new AppError("VALIDATION_FAILED", { message: "We could not accept this request. Please call the clinic to book." });
    }

    await connectToDatabase();
    const ip = clientIp(request);
    await enforceRateLimit(RATE_LIMITS.appointmentCreateIp, ip);
    await enforceRateLimit(RATE_LIMITS.appointmentCreatePhone, body.patient.phone);

    const userAgent = request.headers.get("user-agent");
    const { appointment, replayed } = await createWebAppointment(body, {
      ipHash: hashIdentifier(ip),
      userAgentHash: userAgent ? hashIdentifier(userAgent) : undefined,
    });

    if (!replayed) after(() => notifyAppointmentEvent(appointment._id, "received"));

    const settings = await findSettings();
    const emailWillBeSent = Boolean(appointment.patient.email && getEmailProvider() && settings?.notifications?.patientAck !== false);
    return jsonOk(
      {
        reference: appointment.reference,
        status: appointment.status,
        start: appointment.start.toISOString(),
        serviceTitle: appointment.serviceTitle,
        emailWillBeSent,
        ...(replayed ? { replayed: true } : {}),
      },
      { status: replayed ? 200 : 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
