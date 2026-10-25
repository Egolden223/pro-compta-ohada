import { createFileRoute } from "@tanstack/react-router";
import { PlanPage } from "@/pages/misc";

export const Route = createFileRoute("/plan")({ component: PlanPage });
