import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { db } from "../../data/db";

export default function ViewDiagramList() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    db.diagrams
      .orderBy("lastModified")
      .reverse()
      .toArray()
      .then((rows) => {
        if (!mounted) return;
        setItems(rows || []);
      })
      .finally(() => setBusy(false));
    return () => {
      mounted = false;
    };
  }, []);

  const openDiagram = (id) => {
    // editor রুটে ?d=<id> দিয়ে নেভিগেট
    navigate(`/editor?d=${id}`);
  };

  const deleteDiagram = async (id) => {
    if (!window.confirm("Delete this diagram permanently?")) return;
    await db.diagrams.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div style={{ maxWidth: 920, margin: "24px auto", padding: "0 16px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>Saved Diagrams</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/editor">
            <button style={{ padding: "8px 12px", cursor: "pointer" }}>
              Back to Editor
            </button>
          </Link>
        </div>
      </header>

      <div style={{ marginTop: 16 }}>
        {busy ? (
          <div>Loading…</div>
        ) : items.length === 0 ? (
          <div>No saved diagrams found.</div>
        ) : (
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th style={th}>ID</th>
                  <th style={th}>Name</th>
                  <th style={th}>Database</th>
                  <th style={th}>Last Saved</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={td}>{d.id}</td>
                    <td
                      style={{
                        ...td,
                        maxWidth: 280,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.name || "Untitled"}
                    </td>
                    <td style={td}>{d.database || "-"}</td>
                    <td style={td}>
                      {d.lastModified
                        ? new Date(d.lastModified).toLocaleString()
                        : "-"}
                    </td>
                    <td style={{ ...td, minWidth: 180 }}>
                      <button onClick={() => openDiagram(d.id)} style={btn}>
                        Open
                      </button>
                      <button
                        onClick={() => deleteDiagram(d.id)}
                        style={{ ...btn, marginLeft: 8 }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "10px 12px",
  fontWeight: 600,
  fontSize: 14,
};
const td = { padding: "10px 12px", fontSize: 14 };
const btn = { padding: "6px 10px", cursor: "pointer" };
