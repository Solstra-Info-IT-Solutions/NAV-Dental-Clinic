import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const serviceSchema = new Schema(
  {
    slug: { type: String, required: true, match: /^[a-z0-9]+(-[a-z0-9]+)*$/, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    summary: { type: String, required: true, trim: true, maxlength: 200 },
    sections: {
      type: [
        new Schema(
          {
            heading: { type: String, required: true, maxlength: 100 },
            paragraphs: { type: [{ type: String, maxlength: 3000 }], default: [] },
          },
          { _id: false },
        ),
      ],
      validate: [(v: unknown[]) => v.length <= 8, "At most 8 sections"],
      default: [],
    },
    faqs: {
      type: [new Schema({ q: { type: String, required: true, maxlength: 200 }, a: { type: String, required: true, maxlength: 1000 } }, { _id: false })],
      validate: [(v: unknown[]) => v.length <= 10, "At most 10 FAQs"],
      default: [],
    },
    durationMinutes: { type: Number, min: 10, max: 480 },
    published: { type: Boolean, default: false },
    bookable: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    seo: { title: { type: String, maxlength: 60 }, description: { type: String, maxlength: 160 } },
    redirectFrom: { type: [String], default: [] },
  },
  { collection: "services", timestamps: true },
);

serviceSchema.index({ slug: 1 }, { unique: true });
serviceSchema.index({ published: 1, order: 1 });
serviceSchema.index({ redirectFrom: 1 });

export type ServiceDoc = InferSchemaType<typeof serviceSchema>;

export const ServiceModel: Model<ServiceDoc> = (models.Service as Model<ServiceDoc>) ?? model<ServiceDoc>("Service", serviceSchema);
