import { Router, type IRouter } from "express";
import { LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";
import { signToken, requireAuth } from "../middlewares/auth";

const MOCK_USER = {
  email: "admin@scopic.com",
  password: "123456",
  name: "Admin",
};

const router: IRouter = Router();

router.post("/auth/login", (req, res) => {
  const { email, password } = LoginBody.parse(req.body);

  if (email !== MOCK_USER.email || password !== MOCK_USER.password) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const user = { email: MOCK_USER.email, name: MOCK_USER.name };
  const token = signToken(user);

  const data = LoginResponse.parse({ token, user });
  res.json(data);
});

router.get("/auth/me", requireAuth, (req, res) => {
  const user = (req as any).user;
  const data = GetMeResponse.parse({ email: user.email, name: user.name });
  res.json(data);
});

export default router;
