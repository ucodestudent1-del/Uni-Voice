import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { truncateTestDb, createTestBusiness, createTestUser } from "./helpers/db.js";
import { generateToken } from "../src/middleware/auth.js";
import { query } from "../src/db/pool.js";

const agent = request(app);

function authHeader(userId: string, businessId: string, email: string) {
  const token = generateToken(userId, businessId, email);
  return { Authorization: `Bearer ${token}` };
}

async function addBusinessUser(businessId: string, userId: string, role: string) {
  await query(
    `INSERT INTO business_users (business_id, user_id, role, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (business_id, user_id) DO UPDATE SET role = $3, status = 'active'`,
    [businessId, userId, role],
  );
}

describe("RBAC (integration)", () => {
  let business: { id: string; ownerId: string };

  beforeEach(async () => {
    await truncateTestDb();
    business = await createTestBusiness();
  });

  describe("Team management routes", () => {
    let viewerHeaders: { Authorization: string };
    let memberUserId: string;
    let memberHeaders: { Authorization: string };
    let adminHeaders: { Authorization: string };

    beforeEach(async () => {
      const viewer = await createTestUser({ id: "11111111-1111-1111-1111-111111111112", email: "viewer@example.com", businessId: business.id });
      const member = await createTestUser({ id: "11111111-1111-1111-1111-111111111113", email: "member@example.com", businessId: business.id });
      const admin = await createTestUser({ id: "11111111-1111-1111-1111-111111111114", email: "admin@example.com", businessId: business.id });

      memberUserId = member.id;

      await addBusinessUser(business.id, viewer.id, "viewer");
      await addBusinessUser(business.id, member.id, "member");
      await addBusinessUser(business.id, admin.id, "admin");

      viewerHeaders = authHeader(viewer.id, business.id, viewer.email);
      memberHeaders = authHeader(member.id, business.id, member.email);
      adminHeaders = authHeader(admin.id, business.id, admin.email);
    });

    it("viewer cannot POST to team (invite)", async () => {
      const res = await agent.post("/api/businesses/current/team").set(viewerHeaders).send({
        email: "new@example.com",
        role: "member",
      });
      expect(res.status).toBe(403);
    });

    it("admin can POST to team (invite)", async () => {
      const res = await agent.post("/api/businesses/current/team").set(adminHeaders).send({
        email: "new@example.com",
        role: "member",
      });
      expect(res.status).toBe(201);
    });

    it("member cannot PATCH team member role", async () => {
      const memberRow = await query(
        `SELECT id FROM business_users WHERE business_id = $1 AND user_id = $2 LIMIT 1`,
        [business.id, memberUserId],
      );
      const memberBuId = memberRow.rows[0].id;
      const res = await agent.patch(`/api/businesses/current/team/${memberBuId}`).set(memberHeaders).send({
        role: "admin",
      });
      expect(res.status).toBe(403);
    });

    it("admin can PATCH team member role", async () => {
      const memberRow = await query(
        `SELECT id FROM business_users WHERE business_id = $1 AND user_id = $2 LIMIT 1`,
        [business.id, memberUserId],
      );
      const memberBuId = memberRow.rows[0].id;
      const res = await agent.patch(`/api/businesses/current/team/${memberBuId}`).set(adminHeaders).send({
        role: "admin",
      });
      expect(res.status).toBe(200);
    });
  });

  describe("Subscription routes", () => {
    let viewerHeaders: { Authorization: string };
    let adminHeaders: { Authorization: string };

    beforeEach(async () => {
      const viewer = await createTestUser({ id: "31111111-1111-1111-1111-111111111112", email: "viewer2@example.com", businessId: business.id });
      const admin = await createTestUser({ id: "31111111-1111-1111-1111-111111111114", email: "admin2@example.com", businessId: business.id });

      await addBusinessUser(business.id, viewer.id, "viewer");
      await addBusinessUser(business.id, admin.id, "admin");

      viewerHeaders = authHeader(viewer.id, business.id, viewer.email);
      adminHeaders = authHeader(admin.id, business.id, admin.email);
    });

    it("viewer cannot POST to subscription/upgrade", async () => {
      const res = await agent.post("/api/subscription/upgrade").set(viewerHeaders).send({
        planCode: "enterprise",
      });
      expect(res.status).toBe(403);
    });

    it("admin can view subscription/current", async () => {
      const res = await agent.get("/api/subscription/current").set(adminHeaders);
      expect(res.status).toBe(200);
    });
  });

  describe("Product routes", () => {
    let viewerHeaders: { Authorization: string };
    let memberHeaders: { Authorization: string };
    let adminHeaders: { Authorization: string };

    beforeEach(async () => {
      const viewer = await createTestUser({ id: "41111111-1111-1111-1111-111111111112", email: "viewer3@example.com", businessId: business.id });
      const member = await createTestUser({ id: "41111111-1111-1111-1111-111111111113", email: "member3@example.com", businessId: business.id });
      const admin = await createTestUser({ id: "41111111-1111-1111-1111-111111111114", email: "admin3@example.com", businessId: business.id });

      await addBusinessUser(business.id, viewer.id, "viewer");
      await addBusinessUser(business.id, member.id, "member");
      await addBusinessUser(business.id, admin.id, "admin");

      viewerHeaders = authHeader(viewer.id, business.id, viewer.email);
      memberHeaders = authHeader(member.id, business.id, member.email);
      adminHeaders = authHeader(admin.id, business.id, admin.email);
    });

    it("viewer cannot POST a product", async () => {
      const res = await agent.post("/api/products").set(viewerHeaders).send({ name: "Test Product" });
      expect(res.status).toBe(403);
    });

    it("member can POST a product", async () => {
      const res = await agent.post("/api/products").set(memberHeaders).send({ name: "Test Product" });
      expect(res.status).toBe(201);
      expect(res.body.product.name).toBe("Test Product");
    });

    it("admin can DELETE a product", async () => {
      const createRes = await agent.post("/api/products").set(memberHeaders).send({ name: "Product to Delete" });
      const productId = createRes.body.product.id;
      const res = await agent.delete(`/api/products/${productId}`).set(adminHeaders);
      expect(res.status).toBe(204);
    });

    it("viewer cannot DELETE a product", async () => {
      const createRes = await agent.post("/api/products").set(memberHeaders).send({ name: "Product to Keep" });
      const productId = createRes.body.product.id;
      const res = await agent.delete(`/api/products/${productId}`).set(viewerHeaders);
      expect(res.status).toBe(403);
    });
  });

  describe("Template routes", () => {
    let viewerHeaders: { Authorization: string };
    let memberHeaders: { Authorization: string };

    beforeEach(async () => {
      const viewer = await createTestUser({ id: "51111111-1111-1111-1111-111111111112", email: "viewer4@example.com", businessId: business.id });
      const member = await createTestUser({ id: "51111111-1111-1111-1111-111111111113", email: "member4@example.com", businessId: business.id });

      await addBusinessUser(business.id, viewer.id, "viewer");
      await addBusinessUser(business.id, member.id, "member");

      viewerHeaders = authHeader(viewer.id, business.id, viewer.email);
      memberHeaders = authHeader(member.id, business.id, member.email);
    });

    it("viewer cannot POST a template", async () => {
      const res = await agent.post("/api/templates").set(viewerHeaders).send({ name: "Test Template" });
      expect(res.status).toBe(403);
    });

    it("member can POST a template", async () => {
      const res = await agent.post("/api/templates").set(memberHeaders).send({ name: "Test Template" });
      expect(res.status).toBe(201);
      expect(res.body.template.name).toBe("Test Template");
    });
  });

  describe("Customer routes (create)", () => {
    let viewerHeaders: { Authorization: string };
    let memberHeaders: { Authorization: string };

    beforeEach(async () => {
      const viewer = await createTestUser({ id: "61111111-1111-1111-1111-111111111112", email: "viewer5@example.com", businessId: business.id });
      const member = await createTestUser({ id: "61111111-1111-1111-1111-111111111113", email: "member5@example.com", businessId: business.id });

      await addBusinessUser(business.id, viewer.id, "viewer");
      await addBusinessUser(business.id, member.id, "member");

      viewerHeaders = authHeader(viewer.id, business.id, viewer.email);
      memberHeaders = authHeader(member.id, business.id, member.email);
    });

    it("viewer cannot POST a customer", async () => {
      const res = await agent.post("/api/customers").set(viewerHeaders).send({ name: "Test Customer" });
      expect(res.status).toBe(403);
    });

    it("member can POST a customer", async () => {
      const res = await agent.post("/api/customers").set(memberHeaders).send({ name: "Test Customer" });
      expect(res.status).toBe(201);
      expect(res.body.customer.name).toBe("Test Customer");
    });
  });
});
