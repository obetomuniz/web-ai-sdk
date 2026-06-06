import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

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
};
