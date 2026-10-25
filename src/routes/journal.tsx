import { createFileRoute } from "@tanstack/react-router";
import { JournalGeneralPage } from "@/pages/etats";

export const Route = createFileRoute("/journal")({ component: JournalGeneralPage });
