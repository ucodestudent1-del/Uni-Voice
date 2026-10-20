import { useState } from "react";
import { X, RefreshCw, Download, Send } from "lucide-react";
import { Button } from "@/components/ui";
import type { DocumentState } from "./document-types";

interface DocumentPreviewPanelProps {
  open: boolean;
  onClose: () => void;
  docType: string;
  state: DocumentState;
  pdfUrl?: string | null;
  onRefresh: () => void;
  onDownload: () => void;
  onSend: () => void;
  isGeneratingPdf?: boolean;
}

export function DocumentPreviewPanel({
  open,
  onClose,
  docType,
  state,
  pdfUrl,
  onRefresh,
  onDownload,
  onSend,
  isGeneratingPdf = false,
}: DocumentPreviewPanelProps) {
  const [width, setWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = startX - moveEvent.clientX;
      const newWidth = Math.max(300, startWidth + diff);
      setWidth(Math.min(newWidth, window.innerWidth * 0.7));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  if (!open) return null;

  const displayName = state.customerId || state.currency || "";
  const docTitle = `${docType.charAt(0).toUpperCase() + docType.slice(1)} - ${displayName || "Preview"}`;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col bg-surface border-l border-color shadow-xl transition-all"
        style={{ width: `${width}px` }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-color bg-surface-alt">
          <div className="flex items-center gap-2">
            <span className="font-medium text-primary">{docTitle}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={onRefresh}
              loading={isGeneratingPdf}
              title="Refresh preview"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={onDownload}
              title="Download PDF"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Send className="h-4 w-4" />}
              onClick={onSend}
              title="Send"
            />
            <button
              onClick={onClose}
              className="p-1 text-tertiary hover:text-primary rounded hover:bg-surface-alt"
              title="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-tertiary-bg">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="Document preview"
              className="w-full h-full border-0"
            />
          ) : (
            <div className="p-6 space-y-4">
              <div className="aspect-[210/297] bg-white rounded-lg shadow-md flex flex-col">
                <div className="p-6 border-b">
                  <div className="text-xs text-tertiary mb-1">
                    {docType.charAt(0).toUpperCase() + docType.slice(1)} #
                    {state.currency ?? ""}
                  </div>
                  <div className="text-xl font-bold text-primary mb-2">
                    {displayName || "Preview"}
                  </div>
                  <div className="text-xs text-tertiary space-y-0.5">
                    Customer ID: {state.customerId || "—"}
                  </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 text-tertiary">Item</th>
                        <th className="text-right py-1 text-tertiary">Qty</th>
                        <th className="text-right py-1 text-tertiary">Price</th>
                        <th className="text-right py-1 text-tertiary">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.items.map((item, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-1 text-primary">{item.description}</td>
                          <td className="text-right py-1 text-tertiary">{item.quantity}</td>
                          <td className="text-right py-1 text-tertiary">{item.unitPrice}</td>
                          <td className="text-right py-1 text-tertiary">
                            ${(Number(item.quantity) * Number(item.unitPrice) || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-6 border-t">
                  <div className="text-xs text-tertiary">
                    {state.notes || "No notes added yet."}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 z-10"
          onMouseDown={handleMouseDown}
        />
        {isDragging && <div className="fixed inset-0 pointer-events-none z-50" />}
      </div>
    </>
  );
}
