import { createFileRoute } from "@tanstack/react-router";
import { MissingPage } from "@/components/missing-page";

export const Route = createFileRoute("/the-way")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: MissingPage,
});
