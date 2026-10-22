import "server-only";

import { ServiceModel, type ServiceDoc } from "@/lib/db/models";

import { SERVICE_CATALOG, type ServiceContent } from "./catalog";

/** Plain, serialisable shape used by pages and the public API. */
export function toServiceContent(doc: ServiceDoc): ServiceContent {
  return {
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    sections: (doc.sections ?? []).map((s) => ({ heading: s.heading, paragraphs: [...(s.paragraphs ?? [])] })),
    faqs: (doc.faqs ?? []).map((f) => ({ q: f.q, a: f.a })),
    published: doc.published,
    bookable: doc.bookable,
    order: doc.order,
  };
}

export async function findPublishedServices(): Promise<ServiceContent[]> {
  const docs = await ServiceModel.find({ published: true }).sort({ order: 1, title: 1 }).lean<ServiceDoc[]>().exec();
  return docs.map(toServiceContent);
}

/** Inserts catalog services that do not exist yet. Existing (possibly edited) services are left untouched. */
export async function seedServices(): Promise<{ inserted: number }> {
  const result = await ServiceModel.bulkWrite(
    SERVICE_CATALOG.map((service) => ({
      updateOne: { filter: { slug: service.slug }, update: { $setOnInsert: service }, upsert: true },
    })),
    { ordered: false },
  );
  return { inserted: result.upsertedCount };
}
