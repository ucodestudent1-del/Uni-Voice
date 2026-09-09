import { useParams, useNavigate } from "react-router-dom";
import InvoiceEditor from "../components/InvoiceEditor";

export default function InvoiceEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceEditor />;
}
