import { describe, it, expect, vi, beforeEach } from "vitest";
import { DocumentService } from "../src/services/document-service.js";
import { OutputService } from "../src/services/output/output-service.js";
import type { OutputResult, OutputProvider } from "../src/services/output/types.js";

function makeMockHandler() {
  return {
    toTemplateData: vi.fn(),
    finalize: vi.fn(),
    send: vi.fn(),
    generatePdf: vi.fn(),
    validate: vi.fn(),
  };
}

function makeTestArtifactService() {
  const store: Record<string, any> = {};
  let nextId = 1;
  return {
    store: vi.fn(async (input: any) => {
      const id = `art_${nextId++}`;
      const artifact = {
        id,
        businessId: input.businessId,
        documentId: input.documentId,
        documentType: input.documentType,
        outputFormat: input.outputFormat,
        filePath: `artifacts/${input.documentType}/${input.documentId}/${input.outputFormat}.pdf`,
        fileUrl: `http://test/api/documents/${input.documentId}/artifacts/${id}`,
        sha256: "abc123",
        fileSizeBytes: 100,
        generatedBy: input.generatedBy ?? null,
        generatedAt: new Date(),
        expiresAt: null,
        metadata: input.metadata ?? {},
      };
      store[`${input.documentId}:${input.documentType}:${input.outputFormat}`] = artifact;
      return artifact;
    }),
    getByKey: vi.fn(async (businessId: string, documentId: string, documentType: string, outputFormat: string) => {
      return store[`${documentId}:${documentType}:${outputFormat}`] ?? null;
    }),
    getByHash: vi.fn(async (businessId: string, sha256: string) => null),
    list: vi.fn(async (businessId: string, documentId: string, documentType?: string) => {
      const results = Object.values(store).filter((a) => a.documentId === documentId);
      if (documentType) {
        return results.filter((a) => a.documentType === documentType);
      }
      return results;
    }),
    cleanupExpired: vi.fn(async () => 0),
    getWithData: vi.fn(async () => null),
  };
}

  function makeMockOutputService(): OutputService {
  const stubProvider: OutputProvider = {
    name: "stub",
    supportedFormats: ["pdf", "html"],
    async generate(input: any): Promise<OutputResult> {
      return {
        format: input.options.format,
        mimeType: "application/pdf",
        filename: `test.pdf`,
        data: Buffer.from("fake-pdf-data"),
        sha256: "fake-sha256",
        metadata: {},
      };
    },
  };
  return new OutputService({ providers: new Map([["pdf", stubProvider]]) });
}

describe("DocumentService", () => {
  let service: DocumentService;
  let mockHandler: ReturnType<typeof makeMockHandler>;
  let mockArtifactService: ReturnType<typeof makeTestArtifactService>;
  let mockOutputService: OutputService;

  beforeEach(() => {
    mockHandler = makeMockHandler();
    mockArtifactService = makeTestArtifactService();
    mockOutputService = makeMockOutputService();

    service = new DocumentService({
      outputService: mockOutputService,
      artifactService: mockArtifactService as any,
    });

    service.registerHandler("invoice", mockHandler as any);
  });

  it("registerHandler and hasHandler work", () => {
    expect(service.hasHandler("invoice")).toBe(true);
    expect(service.hasHandler("receipt")).toBe(false);
  });

  it("getHandler throws for unregistered type", () => {
    expect(() => service.getHandler("receipt")).toThrow("No document handler registered for type: receipt");
  });

  it("finalizeDocument delegates to handler.finalize", async () => {
    mockHandler.toTemplateData.mockResolvedValue({ invoice: { currency: "USD" } } as any);
    mockHandler.finalize.mockResolvedValue({
      document: { id: "inv-1" },
      documentNumber: "INV-001",
      status: "finalized",
    });

    const result = await service.finalizeDocument("invoice", "biz-1", "inv-1", "user-1");
    expect(result.documentNumber).toBe("INV-001");
    expect(result.status).toBe("finalized");
    expect(mockHandler.finalize).toHaveBeenCalledWith("biz-1", "inv-1", "user-1");
  });

  it("finalizeDocument throws when handler has no finalize", async () => {
    const handler = makeMockHandler();
    delete (handler as any).finalize;
    service.registerHandler("receipt", handler as any);

    await expect(service.finalizeDocument("receipt", "biz-1", "rcpt-1")).rejects.toThrow(
      "Handler for receipt does not support finalize"
    );
  });

  it("sendDocument delegates to handler.send", async () => {
    mockHandler.send.mockResolvedValue({
      ok: true,
      success: true,
      messageId: "msg-1",
      status: "sent",
    });

    const result = await service.sendDocument("invoice", "biz-1", "inv-1", { to: "test@example.com" });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg-1");
    expect(result.status).toBe("sent");
  });

  it("sendDocument throws when handler has no send", async () => {
    const handler = makeMockHandler();
    delete (handler as any).send;
    service.registerHandler("receipt", handler as any);

    await expect(service.sendDocument("receipt", "biz-1", "rcpt-1", {})).rejects.toThrow(
      "Handler for receipt does not support send"
    );
  });

  it("generateOutput caches artifacts", async () => {
    mockHandler.toTemplateData.mockResolvedValue({ invoice: { currency: "USD" } } as any);

    const result1 = await service.generateOutput("invoice", "biz-1", "inv-1", "pdf");
    expect(result1.fromCache).toBe(false);
    expect(mockArtifactService.store).toHaveBeenCalledTimes(1);
    expect(mockArtifactService.getByKey).toHaveBeenCalledTimes(1);

    const result2 = await service.generateOutput("invoice", "biz-1", "inv-1", "pdf");
    expect(result2.fromCache).toBe(true);
    expect(mockArtifactService.store).toHaveBeenCalledTimes(1);
  });

  it("generateOutput normalizes document type key for cache lookup", async () => {
    mockHandler.toTemplateData.mockResolvedValue({ invoice: { currency: "USD" } } as any);

    await service.generateOutput("invoice", "biz-1", "inv-1", "pdf");

    expect(mockArtifactService.getByKey).toHaveBeenCalledWith("biz-1", "inv-1", "invoice", "pdf");
  });

  it("getDocumentArtifacts returns normalized list", async () => {
    mockArtifactService.list.mockResolvedValue([
      {
        id: "art-1",
        outputFormat: "pdf",
        fileUrl: "http://test",
        sha256: "abc",
        fileSizeBytes: 100,
        generatedAt: new Date(),
        metadata: {},
      },
    ]);

    const artifacts = await service.getDocumentArtifacts("biz-1", "inv-1");
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].outputFormat).toBe("pdf");
  });
});

describe("OutputService", () => {
  it("getMimeType returns correct MIME types", () => {
    expect(OutputService.getMimeType("pdf")).toBe("application/pdf");
    expect(OutputService.getMimeType("html")).toBe("text/html");
    expect(OutputService.getMimeType("docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(OutputService.getMimeType("csv")).toBe("text/csv");
    expect(OutputService.getMimeType("png")).toBe("image/png");
    expect(OutputService.getMimeType("svg")).toBe("image/svg+xml");
    expect(OutputService.getMimeType("unknown" as any)).toBe("application/octet-stream");
  });

  it("buildFilename constructs expected filenames", () => {
    expect(OutputService.buildFilename("invoice", "inv-1", "pdf")).toBe("invoice-inv-1.pdf");
    expect(OutputService.buildFilename("receipt", undefined, "pdf")).toBe("receipt-document.pdf");
  });

  it("computeSha256 produces consistent hashes", () => {
    const hash1 = OutputService.computeSha256("test");
    const hash2 = OutputService.computeSha256(Buffer.from("test"));
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("generate throws when no provider registered", async () => {
    const os = new OutputService();
    await expect(os.generate("pdf", "<p>test</p>", { currency: "USD", docType: "invoice", docId: "1" })).rejects.toThrow(
      "No output provider registered for format: pdf"
    );
  });

  it("register and isSupported work", () => {
    const os = new OutputService();
    expect(os.isSupported("pdf")).toBe(false);

    os.register("pdf", {
      name: "stub",
      supportedFormats: ["pdf"],
      async generate() {
        return {
          format: "pdf",
          mimeType: "application/pdf",
          filename: "test.pdf",
          data: Buffer.from("test"),
          sha256: "abc",
          metadata: {},
        };
      },
    });

    expect(os.isSupported("pdf")).toBe(true);
    expect(os.getSupportedFormats()).toContain("pdf");
  });
});
