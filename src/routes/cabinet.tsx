import { createFileRoute } from "@tanstack/react-router";
import { CabinetPage } from "@/pages/cabinet";

export const Route = createFileRoute("/cabinet")({ component: CabinetPage });
