import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  AdminLoginBody,
  AdminLoginResponse,
  AdminLogoutResponse,
  GetCurrentAdminResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const parsed = AdminLoginBody.parse(req.body);
    const { email, password } = parsed;

    const [user] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    req.session.regenerate((err) => {
      if (err) {
        req.log.error({ err }, "Session regeneration error");
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      req.session.adminId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) {
          req.log.error({ saveErr }, "Session save error");
          res.status(500).json({ error: "Internal server error" });
          return;
        }
        const response = AdminLoginResponse.parse({
          message: "Login successful",
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          },
        });
        res.json(response);
      });
    });
  } catch (error) {
    req.log.error({ error }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    const response = AdminLogoutResponse.parse({ message: "Logged out" });
    res.json(response);
  });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session?.adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, req.session.adminId))
      .limit(1);

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const response = GetCurrentAdminResponse.parse({
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });

    res.json(response);
  } catch (error) {
    req.log.error({ error }, "Auth check error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
