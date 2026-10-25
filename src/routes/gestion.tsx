import { createFileRoute } from "@tanstack/react-router";
import { GestionPage } from "@/pages/gestion";

export const Route = createFileRoute("/gestion")({ component: GestionPage });
