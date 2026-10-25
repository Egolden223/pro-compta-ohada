import { createFileRoute } from "@tanstack/react-router";
import { BilanPage } from "@/pages/etats";

export const Route = createFileRoute("/bilan")({ component: BilanPage });
