import { createFileRoute } from "@tanstack/react-router";
import { SaisiePage } from "@/pages/saisie";

export const Route = createFileRoute("/saisie")({ component: SaisiePage });
