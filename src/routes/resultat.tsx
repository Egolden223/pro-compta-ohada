import { createFileRoute } from "@tanstack/react-router";
import { ResultatPage } from "@/pages/etats";

export const Route = createFileRoute("/resultat")({ component: ResultatPage });
