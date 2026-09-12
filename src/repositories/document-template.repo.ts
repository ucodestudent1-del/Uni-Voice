import { query, getClient } from "../db/pool.js";
import type { DocumentTemplate, DocumentTemplateRevision, DocumentTemplateSchemaVersionRecord } from "../domain/models/index.js";
import { NotFoundError, ConflictError, ValidationError } from "../domain/errors.js";