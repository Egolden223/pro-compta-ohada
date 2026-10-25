import { createFileRoute } from "@tanstack/react-router";
import { RecurringPage } from "@/pages/recurring";

export const Route = createFileRoute("/recurring")({ component: RecurringPage });
