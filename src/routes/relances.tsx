import { createFileRoute } from "@tanstack/react-router";
import { RelancesPage } from "@/pages/misc";

export const Route = createFileRoute("/relances")({ component: RelancesPage });
