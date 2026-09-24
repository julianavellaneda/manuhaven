import "server-only";

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { templates } from "@/lib/db/schema";

// Templates are global, seeded rows, not user data, so nothing here is
// scoped by user.

export async function listActiveTemplates() {
  return getDb()
    .select({
      id: templates.id,
      name: templates.name,
      genre: templates.genre,
      description: templates.description,
      supportsEpub: templates.supportsEpub,
      supportsPdf: templates.supportsPdf,
    })
    .from(templates)
    .where(eq(templates.isActive, true))
    .orderBy(asc(templates.name));
}

export async function getTemplate(templateId: string) {
  const [row] = await getDb()
    .select({ id: templates.id, genre: templates.genre })
    .from(templates)
    .where(eq(templates.id, templateId));
  return row ?? null;
}
