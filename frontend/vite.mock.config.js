// Temporary: local mock API for mobile screenshots. Not part of the app.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const names = ["Arun Kumar", "Priya Raman", "Karthik Subramanian", "Divya Lakshmi", "Suresh Babu", "Meena Krishnan", "Vignesh Rajan", "Anitha Selvam"];
const now = Date.now();
const members = names.map((name, i) => ({
  id: `m${i}`, name, batch: [2001, 2003, 2004, 2010][i % 4], email: `${name.split(" ")[0].toLowerCase()}@mail.com`,
  mobile: `98765432${10 + i}`, city: ["Chennai", "Coimbatore", "Madurai", "Bengaluru"][i % 4],
  occupation: ["Software engineer", "Doctor", "Teacher", "Entrepreneur"][i % 4], qualification: "B.E. Mechanical",
  father: "R. Kumar", mother: "S. Lakshmi", dob: "1985-04-12", gender: "Male", blood: "O+",
  curAddr: "12, Gandhi Street, T. Nagar, Chennai 600017", joinedAt: now - i * 2 * 864e5,
  businesses: i % 3 === 0 ? [{ name: "Kumar Traders", industry: "Retail", role: "Founder", city: "Chennai" }] : [],
  links: [{ label: "LinkedIn", url: "linkedin.com/in/someone" }],
  schools: [{ name: "St. Joseph's Matric Hr. Sec. School", board: "State board", from: "1995", to: "2001" }],
}));
const institution = { name: "St. Joseph's Matric Hr. Sec. School", type: "School", code: "ABC123", batches: [2001, 2003, 2004, 2010, 2012, 2015], admin: { name: "Jeyaram A" } };

const mock = {
  name: "mock-api",
  transform(code, id) {
    if (id.endsWith("site.js")) return code.replace('"https://pupilsweb.yencodetechnologies.in"', '""');
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url.startsWith("/api/")) return next();
      const as = (req.headers.referer || "").match(/[?&]as=(\w+)/)?.[1];
      const send = (code, data) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); };
      if (req.url === "/api/auth/me") {
        if (as === "admin") return send(200, { kind: "admin", institution });
        if (as === "member") return send(200, { kind: "member", member: members[0], institution });
        return send(401, { error: "no" });
      }
      if (req.url === "/api/members") return send(200, { members });
      if (req.url === "/api/me/batchmates") return send(200, { batchmates: members.slice(1, 6) });
      if (req.url.startsWith("/api/join/")) return send(200, { institution });
      send(404, { error: "mock" });
    });
  },
};

export default defineConfig({ plugins: [react(), mock], server: { port: 5199 } });
