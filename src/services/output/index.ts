export type {
  OutputFormat,
  OutputOptions,
  OutputResult,
  OutputProvider,
  OutputProviderInput,
  RenderContext,
  OutputServiceOptions,
} from "./types.js";
export { OutputService } from "./output-service.js";
export { HtmlOutputProvider } from "./html-provider.js";
export { PdfOutputProvider } from "./pdf-provider.js";
export { TextOutputProvider } from "./text-provider.js";
export { CsvOutputProvider } from "./csv-provider.js";
export { EmailHtmlOutputProvider } from "./email-html-provider.js";
export { PngOutputProvider } from "./png-provider.js";
export { SvgOutputProvider } from "./svg-provider.js";
export { StubOutputProvider } from "./stub-provider.js";

import { OutputService } from "./output-service.js";
import { HtmlOutputProvider } from "./html-provider.js";
import { PdfOutputProvider } from "./pdf-provider.js";
import { TextOutputProvider } from "./text-provider.js";
import { CsvOutputProvider } from "./csv-provider.js";
import { EmailHtmlOutputProvider } from "./email-html-provider.js";
import { PngOutputProvider } from "./png-provider.js";
import { SvgOutputProvider } from "./svg-provider.js";
import { StubOutputProvider } from "./stub-provider.js";
import { env } from "../../config/index.js";

export function createDefaultOutputService(): OutputService {
  const service = new OutputService();

  service.register("html", new HtmlOutputProvider());
  service.register("pdf", new PdfOutputProvider(env.PDF_PROVIDER !== "html"));
  service.register("txt", new TextOutputProvider());
  service.register("csv", new CsvOutputProvider());
  service.register("email-html", new EmailHtmlOutputProvider());
  service.register("png", new PngOutputProvider());
  service.register("svg", new SvgOutputProvider());
  service.register("docx", new StubOutputProvider("docx", "docx-stub"));

  return service;
}

export const outputService = createDefaultOutputService();
