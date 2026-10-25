import { createFileRoute } from "@tanstack/react-router";
import { BanquePage } from "@/pages/banque-fiscal";

export const Route = createFileRoute("/banque")({ component: BanquePage });
