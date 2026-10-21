import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui";
import { DocumentConverter } from "@/components/document/DocumentConverter";
import type { DocumentTypeParam, ConvertDocumentResult } from "@/api/client";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useToast } from "@/components/ui";

export default function DocumentConverterPage() {
  useMetaTags({
    title: "Convert Document — DocForge",
    description: "Convert a document to another type or export it in a different format.",
    noIndex: true,
  });

  const { docType, docId } = useParams<{ docType: string; docId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dialogOpen, _setDialogOpen] = useState(true);

  useEffect(() => {
    if (!docType || !docId) {
      toast("Invalid document parameters", { type: "error" });
      navigate("/app/documents");
    }
  }, [docType, docId, navigate, toast]);

  if (!docType || !docId) return null;

  const handleConversionComplete = (result: ConvertDocumentResult) => {
    const routePrefix = docType;
    toast(`Converted to ${result.targetDocumentType} successfully`, { type: "success" });
    navigate(`/app/${routePrefix}/${result.targetDocumentId}/edit`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Convert Document"
        breadcrumbs={[
          { label: "Documents", to: "/app/documents" },
          { label: "Convert Document" },
        ]}
        description="Convert this document to another type or export it in a different format."
      />
      <DocumentConverter
        open={dialogOpen}
        onClose={() => navigate("/app/documents")}
        docType={docType as DocumentTypeParam}
        docId={docId}
        onConversionComplete={handleConversionComplete}
      />
    </div>
  );
}
