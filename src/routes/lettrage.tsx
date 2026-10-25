import { createFileRoute } from "@tanstack/react-router";
import { LettragePage } from "@/pages/lettrage";

export const Route = createFileRoute("/lettrage")({ component: LettragePage });
