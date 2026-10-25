import { createFileRoute } from "@tanstack/react-router";
import { DocumentsPage } from "@/pages/documents";

export const Route = createFileRoute("/documents")({ component: DocumentsPage });
