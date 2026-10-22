import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// ── closures: holidays and exceptional closures (rules, not holds) ──────────
const closureSchema = new Schema(
  {
    startDate: { type: String, required: true, match: DATE },
    endDate: { type: String, required: true, match: DATE },
    allDay: { type: Boolean, required: true, default: true },
    startTime: { type: String, match: TIME },
    endTime: { type: String, match: TIME },
    reason: { type: String, required: true, trim: true, maxlength: 120 },
    publicNote: { type: String, trim: true, maxlength: 120 },
    createdBy: { type: Schema.Types.ObjectId },
  },
  { collection: "closures", timestamps: true },
);
closureSchema.index({ startDate: 1, endDate: 1 });

export type ClosureDoc = InferSchemaType<typeof closureSchema>;
export const ClosureModel: Model<ClosureDoc> = (models.Closure as Model<ClosureDoc>) ?? model<ClosureDoc>("Closure", closureSchema);

// ── slot_holds: the double-booking guard ──────────────────────────────────
// One document per occupied grid slot per chair. The unique index makes the
// database reject a second hold for the same chair and start time, inside
// the same transaction that writes the appointment or block.
const slotHoldSchema = new Schema(
  {
    resourceKey: { type: String, required: true, match: /^chair-[1-5]$/ },
    start: { type: Date, required: true },
    holderType: { type: String, required: true, enum: ["appointment", "block"] },
    holderId: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: "slot_holds", timestamps: { createdAt: true, updatedAt: false } },
);
slotHoldSchema.index({ resourceKey: 1, start: 1 }, { unique: true });
slotHoldSchema.index({ holderType: 1, holderId: 1 });
slotHoldSchema.index({ start: 1 });

export type SlotHoldDoc = InferSchemaType<typeof slotHoldSchema>;
export const SlotHoldModel: Model<SlotHoldDoc> = (models.SlotHold as Model<SlotHoldDoc>) ?? model<SlotHoldDoc>("SlotHold", slotHoldSchema);

// ── slot_blocks: admin manual blocks ──────────────────────────────────────
const slotBlockSchema = new Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    resourceKey: { type: String, required: true, match: /^(chair-[1-5]|all)$/ },
    reason: { type: String, required: true, trim: true, maxlength: 120 },
    createdBy: { type: Schema.Types.ObjectId },
  },
  { collection: "slot_blocks", timestamps: true },
);
slotBlockSchema.index({ start: 1 });

export type SlotBlockDoc = InferSchemaType<typeof slotBlockSchema>;
export const SlotBlockModel: Model<SlotBlockDoc> = (models.SlotBlock as Model<SlotBlockDoc>) ?? model<SlotBlockDoc>("SlotBlock", slotBlockSchema);
