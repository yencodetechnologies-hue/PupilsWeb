import dotenv from "dotenv";
import { setServers } from "node:dns";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Node on this machine only sees 127.0.0.1, which refuses MongoDB SRV lookups.
setServers(["8.8.8.8", "1.1.1.1"]);

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env"),
});
