import { createFileRoute } from "@tanstack/react-router";
import { getChallenge } from "@/lib/forge-db";

export const Route = createFileRoute("/api/forge/challenge")({
  server: {
    handlers: {
      GET: async () => Response.json({ challenge: await getChallenge() }),
    },
  },
});
