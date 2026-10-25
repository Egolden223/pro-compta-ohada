import { createFileRoute } from "@tanstack/react-router";
import { GuidePage } from "@/pages/misc";

export const Route = createFileRoute("/guide")({ component: GuidePage });
