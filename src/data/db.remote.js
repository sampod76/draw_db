// src/data/db.remote.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export const remoteDb = {
  diagrams: {
    async add(data) {
      const res = await fetch(`${API_BASE}/diagrams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      console.log("🚀 ~ add ~ res:", res);
      if (!res.ok) throw new Error("Failed to create");
      const out = await res.json(); // {id}
      return out.id;
    },
    async update(id, data) {
      const res = await fetch(`${API_BASE}/diagrams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return true;
    },
    async get(id) {
      const res = await fetch(`${API_BASE}/diagrams/${id}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch");
      return await res.json();
    },
    async list({ skip = 0, take = 20, query = "" } = {}) {
      const url = new URL(`${API_BASE}/diagrams`);
      url.searchParams.set("skip", skip);
      url.searchParams.set("take", take);
      if (query) url.searchParams.set("query", query);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to list");
      return await res.json(); // {items,total,skip,take}
    },
    async last() {
      const res = await fetch(`${API_BASE}/diagrams-last`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch last");
      return await res.json();
    },
    async delete(id) {
      const res = await fetch(`${API_BASE}/diagrams/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return true;
    },
  },
};
