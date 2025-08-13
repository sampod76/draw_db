import { useState, useEffect, useCallback, createContext } from "react";
import ControlPanel from "./EditorHeader/ControlPanel";
import Canvas from "./EditorCanvas/Canvas";
import { CanvasContextProvider } from "../context/CanvasContext";
import SidePanel from "./EditorSidePanel/SidePanel";
import { DB, State } from "../data/constants";
import { db, putDiagramLocal } from "../data/db"; // ⬅️ db.js: id = string PK (cuid)
import {
  useLayout,
  useSettings,
  useTransform,
  useDiagram,
  useUndoRedo,
  useAreas,
  useNotes,
  useTypes,
  useTasks,
  useSaveState,
  useEnums,
} from "../hooks";
import FloatingControls from "./FloatingControls";
import { Modal, Tag, Toast } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { databases } from "../data/databases";
import { isRtl } from "../i18n/utils/rtl";
import { useSearchParams } from "react-router-dom";
import { get } from "../api/gists";
import cuid from "cuid";
import { remoteDb } from "../data/db.remote";

export const IdContext = createContext({ gistId: "", setGistId: () => {} });

const SIDEPANEL_MIN_WIDTH = 384;

export default function WorkSpace() {
  // ✅ id এখন string (cuid)
  const [id, setId] = useState("");
  const [gistId, setGistId] = useState("");
  const [loadedFromGistId, setLoadedFromGistId] = useState("");
  const [title, setTitle] = useState("Untitled Diagram");
  const [resize, setResize] = useState(false);
  const [width, setWidth] = useState(SIDEPANEL_MIN_WIDTH);
  const [lastSaved, setLastSaved] = useState("");
  const [showSelectDbModal, setShowSelectDbModal] = useState(false);
  const [selectedDb, setSelectedDb] = useState("");

  const { layout } = useLayout();
  const { settings } = useSettings();
  const { types, setTypes } = useTypes();
  const { areas, setAreas } = useAreas();
  const { tasks, setTasks } = useTasks();
  const { notes, setNotes } = useNotes();
  const { saveState, setSaveState } = useSaveState();
  const { transform, setTransform } = useTransform();
  const { enums, setEnums } = useEnums();
  const {
    tables,
    relationships,
    setTables,
    setRelationships,
    database,
    setDatabase,
  } = useDiagram();
  const { undoStack, redoStack, setUndoStack, setRedoStack } = useUndoRedo();
  const { t, i18n } = useTranslation();
  let [searchParams, setSearchParams] = useSearchParams();

  // ---------- helpers ----------
  const makePayload = () => {
    return {
      name: title || "Untitled Diagram",
      database,
      gistId: gistId ?? null,
      loadedFromGistId: loadedFromGistId ?? null,
      tables: tables ?? [],
      references: relationships ?? [],
      notes: notes ?? [],
      areas: areas ?? [],
      todos: tasks ?? [],
      pan: transform?.pan ?? { x: 0, y: 0 },
      zoom: typeof transform?.zoom === "number" ? transform.zoom : 1,
      ...(databases[database]?.hasEnums && { enums: enums ?? [] }),
      ...(databases[database]?.hasTypes && { types: types ?? [] }),
      lastModified: new Date().toISOString(),
    };
  };

  const ensureId = () => {
    if (id && id.length) return id;
    const newId = cuid();
    setId(newId);
    window.name = `d ${newId}`;
    return newId;
  };

  // লোকাল + সার্ভার save (একই সাথে)
  const save = useCallback(async () => {
    if (saveState !== State.SAVING) return;
    try {
      const diagramId = ensureId();
      const payload = makePayload();

      // 1) Local (Dexie) — put by id (string)
      await putDiagramLocal({ id: diagramId, ...payload });

      // 2) Server — upsert by same id
      try {
        await remoteDb.diagrams.add({ id: diagramId, ...payload });
      } catch (e) {
        // সার্ভার না থাকলেও লোকাল সেভ থাকবে — warning দেখালেই যথেষ্ট
        console.warn("Server upsert failed:", e?.message || e);
      }

      setSaveState(State.SAVED);
      setLastSaved(new Date().toLocaleString());
      Toast.success(t("saved"));
    } catch (e) {
      console.error(e);
      setSaveState(State.ERROR);
      Toast.error(t("failed_to_save"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    id,
    title,
    database,
    tables,
    relationships,
    notes,
    areas,
    tasks,
    transform,
    enums,
    types,
    gistId,
    loadedFromGistId,
    saveState,
    setSaveState,
  ]);

  // লোকাল→না পেলে সার্ভার→লোকাল ক্যাশ→UI hydrate
  const loadById = useCallback(
    async (diagramId) => {
      if (!diagramId) return;
      let d = await db.diagrams.get(diagramId);

      if (!d) {
        // fallback to server
        try {
          const remote = await remoteDb.diagrams.get(diagramId);
          console.log("🚀 ~ WorkSpace ~ remote:", remote);
          if (remote) {
            await putDiagramLocal(remote);
            d = remote;
          }
        } catch (e) {
          console.warn("Remote fetch failed:", e?.message || e);
        }
      }

      if (!d) return;

      if (d.database) setDatabase(d.database);
      else setDatabase(DB.GENERIC);

      setId(d.id);
      setGistId(d.gistId || "");
      setLoadedFromGistId(d.loadedFromGistId || "");
      setTitle(d.name || "Untitled Diagram");
      setTables(d.tables || []);
      setRelationships(d.references || []);
      setNotes(d.notes || []);
      setAreas(d.areas || []);
      setTasks(d.todos || []);
      setTransform({ pan: d.pan || { x: 0, y: 0 }, zoom: d.zoom ?? 1 });
      if (databases[d.database]?.hasTypes) setTypes(d.types ?? []);
      if (databases[d.database]?.hasEnums) setEnums(d.enums ?? []);

      window.name = `d ${d.id}`;
    },
    [
      setDatabase,
      setId,
      setGistId,
      setLoadedFromGistId,
      setTitle,
      setTables,
      setRelationships,
      setNotes,
      setAreas,
      setTasks,
      setTransform,
      setTypes,
      setEnums,
    ],
  );

  const handleResize = (e) => {
    if (!resize) return;
    const w = isRtl(i18n.language) ? window.innerWidth - e.clientX : e.clientX;
    if (w > SIDEPANEL_MIN_WIDTH) setWidth(w);
  };

  // অটোসেভ trigger (আপনার আগের মতোই)
  useEffect(() => {
    if (
      tables?.length === 0 &&
      areas?.length === 0 &&
      notes?.length === 0 &&
      types?.length === 0 &&
      tasks?.length === 0
    )
      return;

    if (settings.autosave) {
      setSaveState(State.SAVING);
    }
  }, [
    undoStack,
    redoStack,
    settings.autosave,
    tables?.length,
    areas?.length,
    notes?.length,
    types?.length,
    relationships?.length,
    tasks?.length,
    transform.zoom,
    title,
    gistId,
    setSaveState,
  ]);

  useEffect(() => {
    save();
  }, [saveState, save]);

  // প্রাথমিক লোড (URL ?d= / shareId / window.name ফ্লো)
  const load = useCallback(async () => {
    const loadLatestDiagram = async () => {
      // cuid PK হওয়ায় last() করার বদলে updated order দরকার হলে আলাদা ইনডেক্স রাখুন
      // এখানে সহজে lastModified-এ orderBy করলে চলবে (যদি indexed থাকে)
      await db.diagrams
        .orderBy("lastModified")
        .last()
        .then(async (d) => {
          if (d) {
            await loadById(d.id);
          } else {
            window.name = "";
            if (selectedDb === "") setShowSelectDbModal(true);
          }
        })
        .catch((error) => console.log(error));
    };

    // shareId (GitHub gist) ফ্লো আগের মতো বজায়
    const loadFromGist = async (shareId) => {
      try {
        const res = await get(shareId);
        const diagramSrc = res.data.files["share.json"].content;
        const d = JSON.parse(diagramSrc);
        const newId = cuid();

        const localData = {
          id: newId,
          name: d.title || "Untitled Diagram",
          database: d.database || DB.GENERIC,
          tables: d.tables || [],
          references: d.relationships || [],
          notes: d.notes || [],
          areas: d.subjectAreas || [],
          todos: [],
          pan: d.transform?.pan || { x: 0, y: 0 },
          zoom: d.transform?.zoom ?? 1,
          enums: d.enums || [],
          types: d.types || [],
          gistId: shareId,
          loadedFromGistId: shareId,
          lastModified: new Date().toISOString(),
        };
        await putDiagramLocal(localData);
        await loadById(newId);
      } catch (e) {
        console.log(e);
        setSaveState(State.FAILED_TO_LOAD);
      }
    };

    const shareId = searchParams.get("shareId");
    const dParam = searchParams.get("d");

    if (shareId) {
      await loadFromGist(shareId);
      return;
    }

    if (dParam) {
      await loadById(dParam);
      return;
    }

    if (!window.name || window.name === "") {
      await loadLatestDiagram();
    } else {
      const parts = window.name.split(" ");
      const op = parts[0];
      const _id = parts[1];
      switch (op) {
        case "d": {
          await loadById(_id);
          break;
        }
        // template/lt ফ্লো দরকার হলে এড করুন
        default:
          await loadLatestDiagram();
          break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams, setSaveState, selectedDb, loadById]);

  useEffect(() => {
    document.title = "Editor | drawDB";
    load();
  }, [load]);

  // নতুন diagram (fresh cuid) — ControlPanel থেকে onNew এ কল হবে
  const createNewDiagram = useCallback(() => {
    const newId = cuid();
    // URL থেকে পুরনো d/shareId মুছে ফেলি
    const sp = new URLSearchParams(window.location.search);
    sp.delete("d");
    sp.delete("shareId");
    window.history.replaceState({}, "", `${window.location.pathname}?${sp}`);

    // clear current state
    setId(newId);
    setGistId("");
    setLoadedFromGistId("");
    setTitle("Untitled Diagram");
    setTables([]);
    setRelationships([]);
    setAreas([]);
    setNotes([]);
    setTasks([]);
    setTypes([]);
    setEnums([]);
    setUndoStack([]);
    setRedoStack([]);
    setTransform({ pan: { x: 0, y: 0 }, zoom: 1 });
    setDatabase(DB.GENERIC);

    // window.name আপডেট
    window.name = `d ${newId}`;

    // প্রথম সেভে লোকাল+সার্ভার তৈরি হবে
    setSaveState(State.SAVING);
  }, [
    setTables,
    setRelationships,
    setAreas,
    setNotes,
    setTasks,
    setTypes,
    setEnums,
    setUndoStack,
    setRedoStack,
    setTransform,
    setDatabase,
    setSaveState,
  ]);

  return (
    <div className="h-full flex flex-col overflow-hidden theme">
      <IdContext.Provider value={{ gistId, setGistId }}>
        <ControlPanel
          // props for header
          diagramId={id} // string cuid
          setDiagramId={setId}
          title={title}
          setTitle={setTitle}
          lastSaved={lastSaved}
          // new: give ControlPanel a way to trigger "new"
          onNew={createNewDiagram}
        />
      </IdContext.Provider>

      <div
        className="flex h-full overflow-y-auto"
        onPointerUp={(e) => e.isPrimary && setResize(false)}
        onPointerLeave={(e) => e.isPrimary && setResize(false)}
        onPointerMove={(e) => e.isPrimary && handleResize(e)}
        onPointerDown={(e) => {
          e.target.releasePointerCapture?.(e.pointerId);
        }}
        style={isRtl(i18n.language) ? { direction: "rtl" } : {}}
      >
        {layout.sidebar && (
          <SidePanel resize={resize} setResize={setResize} width={width} />
        )}
        <div className="relative w-full h-full overflow-hidden">
          <CanvasContextProvider className="h-full w-full">
            <Canvas saveState={saveState} setSaveState={setSaveState} />
          </CanvasContextProvider>
          {!(layout.sidebar || layout.toolbar || layout.header) && (
            <div className="fixed right-5 bottom-4">
              <FloatingControls />
            </div>
          )}
        </div>
      </div>

      {/* প্রথমবার DB টাইপ সিলেক্ট */}
      <Modal
        centered
        size="medium"
        closable={false}
        hasCancel={false}
        title={t("pick_db")}
        okText={t("confirm")}
        visible={showSelectDbModal}
        onOk={() => {
          if (selectedDb === "") return;
          setDatabase(selectedDb);
          setShowSelectDbModal(false);
        }}
        okButtonProps={{ disabled: selectedDb === "" }}
      >
        <div className="grid grid-cols-3 gap-4 place-content-center">
          {Object.values(databases).map((x) => (
            <div
              key={x.name}
              onClick={() => setSelectedDb(x.label)}
              className={`space-y-3 p-3 rounded-md border-2 select-none ${
                settings.mode === "dark"
                  ? "bg-zinc-700 hover:bg-zinc-600"
                  : "bg-zinc-100 hover:bg-zinc-200"
              } ${selectedDb === x.label ? "border-zinc-400" : "border-transparent"}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{x.name}</div>
                {x.beta && (
                  <Tag size="small" color="light-blue">
                    Beta
                  </Tag>
                )}
              </div>
              {x.image && (
                <img
                  src={x.image}
                  className="h-8"
                  style={{
                    filter:
                      "opacity(0.4) drop-shadow(0 0 0 white) drop-shadow(0 0 0 white)",
                  }}
                />
              )}
              <div className="text-xs">{x.description}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
