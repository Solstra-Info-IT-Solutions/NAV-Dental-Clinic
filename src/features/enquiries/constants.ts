/** Shared by the Mongoose model (server) and the contact form (browser); keep free of server imports. */
export const ENQUIRY_CATEGORIES = ["general", "appointment", "treatment-info", "feedback", "other"] as const;
export const ENQUIRY_STATUSES = ["new", "in_progress", "resolved", "spam"] as const;
