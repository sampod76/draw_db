import { putDiagramLocal } from "../data/db";
import { remoteDb } from "../data/db.remote";
import cuid from "cuid";

export async function saveBothLocalAndServer({
  currentId, // string | null
  setId, // setter
  title,
  database,
  tables,
  relationships,
  areas,
  notes,
  tasks,
  transform,
  enums,
  types,
  databasesMeta, // databases from your app (hasEnums/hasTypes)
  gistId,
  loadedFromGistId,
}) {
  // 1) ensure id (cuid)
  let id = currentId;
  if (!id) {
    id = cuid(); // নতুন cuid
    if (typeof setId === "function") setId(id);
    window.name = `d ${id}`; // আপনার উইন্ডো নেভিগেশন স্টেট
  }

  // 2) payload বানাই
  const payload = {
    name: title || "Untitled Diagram",
    database,
    gistId: gistId ?? null,
    loadedFromGistId: loadedFromGistId ?? null,
    tables,
    references: relationships,
    notes,
    areas,
    todos: tasks ?? [],
    pan: transform?.pan ?? { x: 0, y: 0 },
    zoom: typeof transform?.zoom === "number" ? transform.zoom : 1,
    ...(databasesMeta[database]?.hasEnums && { enums: enums ?? [] }),
    ...(databasesMeta[database]?.hasTypes && { types: types ?? [] }),
    lastModified: new Date().toISOString(),
  };

  // 3) লোকাল put (id = cuid)
  await putDiagramLocal({ id, ...payload });

  // 4) সার্ভারে upsert
  await remoteDb.diagrams.add(id, payload);

  return id;
}
