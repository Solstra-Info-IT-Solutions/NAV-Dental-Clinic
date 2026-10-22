import { after } from "next/server";

import { spamReason } from "@/features/appointments/spam";
import { enquiryRequestSchema } from "@/features/enquiries/schemas";
import { createEnquiry } from "@/features/enquiries/service";
import { notifyEnquiryReceived } from "@/features/notifications/service";
import { assertSameOrigin, clientIp, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { connectToDatabase } from "@/lib/db/connection";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { enforceRateLimit, hashIdentifier, RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * POST /api/public/enquiries — contact form submission.
 * Bots (honeypot/timing) are refused without storing anything; suspicious
 * content is stored as `spam` for staff review and triggers no alert.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request, enquiryRequestSchema);

    const spam = spamReason({ honeypot: body.hp, formStartedAt: body.formStartedAt });
    if (spam) {
      logger.warn("enquiry.spam_rejected", { reason: spam });
      throw new AppError("VALIDATION_FAILED", { message: "We could not send your message. Please call the clinic instead." });
    }

    await connectToDatabase();
    const ip = clientIp(request);
    await enforceRateLimit(RATE_LIMITS.enquiryCreateIp, ip);
    await enforceRateLimit(RATE_LIMITS.enquiryCreatePhone, body.phone);

    const { enquiry, replayed, flaggedAsSpam } = await createEnquiry(body, {
      ipHash: hashIdentifier(ip),
      fillMs: Math.max(0, Date.now() - body.formStartedAt),
    });
    if (!replayed && !flaggedAsSpam) after(() => notifyEnquiryReceived(enquiry._id));

    // The response is identical for spam-flagged messages so senders learn nothing about filtering.
    return jsonOk({ received: true, ...(replayed ? { replayed: true } : {}) }, { status: replayed ? 200 : 201 });
  } catch (error) {
    return jsonError(error);
  }
}
