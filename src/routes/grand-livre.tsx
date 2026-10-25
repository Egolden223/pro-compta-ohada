import { createFileRoute } from "@tanstack/react-router";
import { GrandLivrePage } from "@/pages/etats";

export const Route = createFileRoute("/grand-livre")({ component: GrandLivrePage });
