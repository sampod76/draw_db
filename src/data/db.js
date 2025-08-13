import Dexie from "dexie";
import { templateSeeds } from "./seeds";

export const db = new Dexie("drawDB");

// v8: id = string (cuid)
db.version(8).stores({
  diagrams: "id, lastModified, loadedFromGistId", // id = string PK (no ++)
  templates: "++id, custom",
});

db.on("populate", (tx) => {
  tx.templates.bulkAdd(templateSeeds).catch(console.log);
});

/**
 * Helper: put (create/update) by id
 */
export function putDiagramLocal(diagram) {
  // diagram.id (cuid) থাকতে হবে

  return db.table("diagrams").put(diagram);
}
