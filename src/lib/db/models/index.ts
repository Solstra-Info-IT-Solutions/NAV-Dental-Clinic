import { AppointmentModel } from "./appointment";
import { ClinicSettingsModel } from "./clinic-settings";
import { EnquiryModel } from "./enquiry";
import { AuditLogModel, NotificationAttemptModel, RateLimitModel } from "./operations";
import { ClosureModel, SlotBlockModel, SlotHoldModel } from "./schedule";
import { ServiceModel } from "./service";

export * from "./appointment";
export * from "./clinic-settings";
export * from "./enquiry";
export * from "./operations";
export * from "./schedule";
export * from "./service";

/** Every application model, for index synchronisation and tests. */
export const ALL_MODELS = [
  ClinicSettingsModel,
  ServiceModel,
  ClosureModel,
  SlotHoldModel,
  SlotBlockModel,
  AppointmentModel,
  EnquiryModel,
  NotificationAttemptModel,
  AuditLogModel,
  RateLimitModel,
] as const;
