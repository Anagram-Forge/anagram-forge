import { createFileRoute } from "@tanstack/react-router";
import { listArchive } from "@/lib/forge-db";

export const Route = createFileRoute("/api/forge/archive")({
  server: {
    handlers: {
      GET: async () => Response.json({ archive: await listArchive() }),
    },
  },
});
