import { createFileRoute } from "@tanstack/react-router";
import { DocumentPrintPage } from "@/pages/document-print";

export const Route = createFileRoute("/documents/$id")({
  component: function DocumentRoute() {
    const { id } = Route.useParams();
    return <DocumentPrintPage id={id} />;
  },
});
