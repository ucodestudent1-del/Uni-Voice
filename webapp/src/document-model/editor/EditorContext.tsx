import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
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
  enableAutosave: (enabled: boolean, delayMs?: number) => void;
  isAutosaveEnabled: boolean;
}

const EditorContext = createContext<EditorContextValue | undefined>(undefined);

interface EditorProviderProps {
  initialDocument: InvoiceDocument;
  onDocumentChange?: (doc: InvoiceDocument) => void;
  autosaveDelayMs?: number;
  children: ReactNode;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({
  initialDocument,
  onDocumentChange,
  autosaveDelayMs = 2000,
  children,
}) => {
  const [document, setDocument] = useState<InvoiceDocument>(initialDocument);
  const [selectedComponentId, setSelectedComponentId] = useState<ComponentId | null>(null);
  const [history, setHistory] = useState<InvoiceDocument[]>([initialDocument]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false);

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef(false);
  const lastSavedVersionRef = useRef(initialDocument.version);

  React.useEffect(() => {
    initializeRegistry();
  }, []);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
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
    setHistoryIndex((prev) => prev + 1);
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
      setDirty(newIndex !== 0);
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
    lastSavedVersionRef.current = document.version;
  }, [document.version]);

  const saveDocument = useCallback(() => {
    onDocumentChange?.(document);
    markSaved();
  }, [document, onDocumentChange, markSaved]);

  const debouncedSave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      if (dirty && isAutosaveEnabled) {
        pendingSaveRef.current = true;
        onDocumentChange?.(document);
        markSaved();
        pendingSaveRef.current = false;
      }
    }, autosaveDelayMs);
  }, [dirty, isAutosaveEnabled, autosaveDelayMs, document, onDocumentChange, markSaved]);

  useEffect(() => {
    if (dirty && isAutosaveEnabled) {
      debouncedSave();
    }
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [dirty, isAutosaveEnabled, debouncedSave]);

  const enableAutosave = useCallback((enabled: boolean, delayMs?: number) => {
    setIsAutosaveEnabled(enabled);
    if (enabled && delayMs) {
      // Timer will be picked up by the effect above
    }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

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
        enableAutosave,
        isAutosaveEnabled,
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