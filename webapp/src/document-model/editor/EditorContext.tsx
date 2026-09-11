import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  InvoiceDocument,
  AnyComponent,
  ComponentId,
  ComponentType,
  ParentId,
  StyleProps,
} from "../types";
import {
  insertComponent,
  updateComponent,
  moveComponent,
  removeComponent,
  setDocumentSettings,
  InsertComponentParams,
  UpdateComponentParams,
  MoveComponentParams,
  RemoveComponentParams,
} from "../document-operations";
import { initializeRegistry } from "../index";

interface EditorContextValue {
  document: InvoiceDocument;
  selectedComponentId: ComponentId | null;
  setDocument: (doc: InvoiceDocument) => void;
  onSelect: (id: ComponentId | null) => void;
  insertComponent: (params: InsertComponentParams) => void;
  updateComponent: (componentId: ComponentId, props: Record<string, unknown>, style?: Partial<StyleProps>) => void;
  moveComponent: (params: MoveComponentParams) => void;
  removeComponent: (params: RemoveComponentParams) => void;
  setSettings: (settings: Partial<InvoiceDocument["settings"]>) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  saveDocument: () => void;
  dirty: boolean;
  markSaved: () => void;
}

const EditorContext = createContext<EditorContextValue | undefined>(undefined);

interface EditorProviderProps {
  initialDocument: InvoiceDocument;
  onDocumentChange?: (doc: InvoiceDocument) => void;
  children: ReactNode;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({
  initialDocument,
  onDocumentChange,
  children,
}) => {
  const [document, setDocument] = useState<InvoiceDocument>(initialDocument);
  const [selectedComponentId, setSelectedComponentId] = useState<ComponentId | null>(null);
  const [history, setHistory] = useState<InvoiceDocument[]>([initialDocument]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [dirty, setDirty] = useState(false);

  React.useEffect(() => {
    initializeRegistry();
  }, []);

  const pushToHistory = useCallback((newDoc: InvoiceDocument) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newDoc);
      if (newHistory.length > 100) {
        return newHistory.slice(newHistory.length - 100);
      }
      return newHistory;
    });
    setHistoryIndex((prev) => {
      const newIndex = prev + 1;
      return Math.min(newIndex, prev + 1);
    });
  }, [historyIndex]);

  const handleDocumentChange = useCallback((newDoc: InvoiceDocument) => {
    const updated = {
      ...newDoc,
      updatedAt: new Date().toISOString(),
      version: newDoc.version + 1,
    };
    setDocument(updated);
    setDirty(true);
    pushToHistory(updated);
    onDocumentChange?.(updated);
  }, [onDocumentChange, pushToHistory]);

  const handleInsertComponent = useCallback((params: InsertComponentParams) => {
    const newDoc = insertComponent(document, params);
    handleDocumentChange(newDoc);
  }, [document, handleDocumentChange]);

  const handleUpdateComponent = useCallback((
    componentId: ComponentId,
    props: Record<string, unknown>,
    style?: Partial<StyleProps>
  ) => {
    const newDoc = updateComponent(document, {
      componentId,
      props,
      style,
    });
    handleDocumentChange(newDoc);
  }, [document, handleDocumentChange]);

  const handleMoveComponent = useCallback((params: MoveComponentParams) => {
    const newDoc = moveComponent(document, params);
    handleDocumentChange(newDoc);
  }, [document, handleDocumentChange]);

  const handleRemoveComponent = useCallback((params: RemoveComponentParams) => {
    const newDoc = removeComponent(document, params);
    handleDocumentChange(newDoc);
    setSelectedComponentId(null);
  }, [document, handleDocumentChange]);

  const handleSetSettings = useCallback((settings: Partial<InvoiceDocument["settings"]>) => {
    const newDoc = setDocumentSettings(document, { settings });
    handleDocumentChange(newDoc);
  }, [document, handleDocumentChange]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const prevDoc = history[newIndex];
      setDocument(prevDoc);
      setHistoryIndex(newIndex);
      setDirty(historyIndex !== 0);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextDoc = history[newIndex];
      setDocument(nextDoc);
      setHistoryIndex(newIndex);
      setDirty(true);
    }
  }, [historyIndex, history]);

  const markSaved = useCallback(() => {
    setDirty(false);
    setHistory([document]);
    setHistoryIndex(0);
  }, [document]);

  const saveDocument = useCallback(() => {
    onDocumentChange?.(document);
    markSaved();
  }, [document, onDocumentChange, markSaved]);

  return (
    <EditorContext.Provider
      value={{
        document,
        selectedComponentId,
        setDocument,
        onSelect: setSelectedComponentId,
        insertComponent: handleInsertComponent,
        updateComponent: handleUpdateComponent,
        moveComponent: handleMoveComponent,
        removeComponent: handleRemoveComponent,
        setSettings: handleSetSettings,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        undo,
        redo,
        saveDocument,
        dirty,
        markSaved,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return ctx;
}
