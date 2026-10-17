import { createFileRoute } from "@tanstack/react-router";
import { bumpAnagram, bumpStrike, bumpVisit, mintStrikeTicket, readCounts, statsBox } from "@/lib/counters";
import { clientIp } from "@/lib/turnstile";

export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(await readCounts(await statsBox()));
      },
      POST: async ({ request }) => {
        let body: { kind?: string; rack?: string; word?: string; ticket?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          body = {};
        }
        const store = await statsBox();
        const ip = clientIp(request);
        if (body.kind === "ticket") {
          const ticket = await mintStrikeTicket(store, ip);
          return Response.json({ ...(await readCounts(store)), ticket });
        }
        if (body.kind === "anagram") {
          return Response.json(await bumpAnagram(store, ip, request, String(body.rack || ""), String(body.word || "")));
        }
        if (body.kind === "strike") {
          return Response.json(await bumpStrike(store, ip, String(body.ticket || "")));
        }
        if (body.kind === "visit" || !body.kind) {
          return Response.json(await bumpVisit(store, ip));
        }
        return Response.json(await readCounts(store));
      },
    },
  },
});
