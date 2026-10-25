import { createFileRoute } from "@tanstack/react-router";
import { AnnexesPage } from "@/pages/annexes";

export const Route = createFileRoute("/annexes")({ component: AnnexesPage });
