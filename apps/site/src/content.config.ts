import { defineCollection } from "astro:content";
import { docsLoader, i18nLoader } from "@astrojs/starlight/loaders";
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema";

export const collections: Record<string, unknown> = {
  docs: defineCollection({
    loader: docsLoader({
      generateId: ({ entry }) => {
        const slug = entry.replace(/\.(md|mdx)$/, "");
        return slug === "index" ? "docs" : `docs/${slug}`;
      },
    }),
    schema: docsSchema(),
  }),
  // Overrides for Starlight's built-in UI strings (src/content/i18n/en.json),
  // e.g. the prev/next pagination labels.
  i18n: defineCollection({
    loader: i18nLoader(),
    schema: i18nSchema(),
  }),
};
