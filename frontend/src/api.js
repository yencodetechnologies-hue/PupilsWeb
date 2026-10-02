import { apiUrl } from "./site";

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(apiUrl(path), {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Could not reach the server. Start it and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export async function downloadCsv() {
  const res = await fetch(apiUrl("/api/members/export.csv"), { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not export the alumni list.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const header = res.headers.get("Content-Disposition") || "";
  const match = header.match(/filename="([^"]+)"/);
  link.href = url;
  link.download = match?.[1] || "alumni.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
