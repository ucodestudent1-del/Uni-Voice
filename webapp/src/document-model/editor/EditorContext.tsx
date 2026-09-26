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
  moveComponentTo,
  removeComponent,
  duplicateComponent as duplicateComponentOp,
  setDocumentSettings,
  findSiblingsDeep,
  InsertComponentParams,
  UpdateComponentParams,
  MoveComponentParams,
  RemoveComponentParams,
  DuplicateComponentParams,
  MoveComponentToParams,
} from "../document-operations";
import { initializeRegistry } from "../index";
import { analytics } from "../../lib/analytics";

interface EditorContextValue {
  document: InvoiceDocument;
  selectedComponentId: ComponentId | null;
  setDocument: (doc: InvoiceDocument) => void;
  onSelect: (id: ComponentId | null) => void;
  insertComponent: (params: InsertComponentParams) => void;
  updateComponent: (componentId: ComponentId, props: Record<string, unknown>, style?: Partial<StyleProps>) => void;
  moveComponent: (params: MoveComponentParams) => void;
  moveComponentTo: (componentId: ComponentId, x?: number, y?: number) => void;
  updateComponentStyle: (componentId: ComponentId, style: Partial<StyleProps>) => void;
  removeComponent: (params: RemoveComponentParams) => void;
  duplicateComponent: (componentId: ComponentId) => void;
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
  const documentRef = useRef(initialDocument);
  const dirtyRef = useRef(false);
  const isAutosaveEnabledRef = useRef(false);

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

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    isAutosaveEnabledRef.current = isAutosaveEnabled;
  }, [isAutosaveEnabled]);

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

  const handleMoveComponentTo = useCallback((componentId: ComponentId, x?: number, y?: number) => {
    const newDoc = moveComponentTo(document, { componentId, x, y });
    handleDocumentChange(newDoc);
  }, [document, handleDocumentChange]);

  const handleUpdateComponentStyle = useCallback((componentId: ComponentId, style: Partial<StyleProps>) => {
    const newDoc = updateComponent(document, {
      componentId,
      style,
    });
    handleDocumentChange(newDoc);
  }, [document, handleDocumentChange]);

  const handleRemoveComponent = useCallback((params: RemoveComponentParams) => {
    const newDoc = removeComponent(document, params);
    handleDocumentChange(newDoc);
    setSelectedComponentId(null);
  }, [document, handleDocumentChange]);

  const handleDuplicateComponent = useCallback((componentId: ComponentId) => {
    const beforeSiblings = findSiblingsDeep(document, componentId);
    const newDoc = duplicateComponentOp(document, { componentId });
    handleDocumentChange(newDoc);
    const afterSiblings = findSiblingsDeep(newDoc, componentId);
    const newSiblings = afterSiblings.filter((id) => !beforeSiblings.includes(id));
    if (newSiblings.length > 0) {
      setSelectedComponentId(newSiblings[0]);
    }
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
      try {
        analytics.trackEvent("undo_performed", { documentId: prevDoc.id, version: prevDoc.version });
      } catch (err) {
        console.warn("Failed to track analytics event:", err);
      }
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextDoc = history[newIndex];
      setDocument(nextDoc);
      setHistoryIndex(newIndex);
      setDirty(true);
      try {
        analytics.trackEvent("redo_performed", { documentId: nextDoc.id, version: nextDoc.version });
      } catch (err) {
        console.warn("Failed to track analytics event:", err);
      }
    }
  }, [historyIndex, history]);

  const markSaved = useCallback(() => {
    setDirty(false);
    lastSavedVersionRef.current = documentRef.current.version;
  }, []);

  const saveDocument = useCallback(() => {
    onDocumentChange?.(documentRef.current);
    markSaved();
  }, [onDocumentChange, markSaved]);

  const debouncedSave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      if (dirtyRef.current && isAutosaveEnabledRef.current) {
        pendingSaveRef.current = true;
        onDocumentChange?.(documentRef.current);
        markSaved();
        pendingSaveRef.current = false;
      }
    }, autosaveDelayMs);
  }, [autosaveDelayMs, onDocumentChange, markSaved]);

  useEffect(() => {
    if (dirty && isAutosaveEnabled) {
      debouncedSave();
    }
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [dirty, isAutosaveEnabled]);

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

  useEffect(() => {
    const isInputElement = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputElement(e.target)) return;

      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        undo();
      }

      if (isMod && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        e.stopPropagation();
        redo();
      }

      if (e.key === "Delete" && selectedComponentId) {
        e.preventDefault();
        e.stopPropagation();
        handleRemoveComponent({ componentId: selectedComponentId });
      }

      if (isMod && (e.key === "d" || e.key === "D") && selectedComponentId) {
        e.preventDefault();
        e.stopPropagation();
        handleDuplicateComponent(selectedComponentId);
      }
    };

    window.document.addEventListener("keydown", handleKeyDown);
    return () => window.document.removeEventListener("keydown", handleKeyDown);
  }, [selectedComponentId, undo, redo, handleRemoveComponent, handleDuplicateComponent]);

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
        moveComponentTo: handleMoveComponentTo,
        updateComponentStyle: handleUpdateComponentStyle,
        removeComponent: handleRemoveComponent,
        duplicateComponent: handleDuplicateComponent,
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