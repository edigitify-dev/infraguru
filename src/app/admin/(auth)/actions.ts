"use server";

import { redirect } from "next/navigation";
import { getAdminByEmail } from "@/lib/db/admin";
import { createSessionCookie, destroySessionCookie, verifyPassword } from "@/lib/auth";

export type LoginState = { error: string } | undefined;

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/admin");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  let admin;
  try {
    admin = await getAdminByEmail(email);
  } catch (err) {
    console.error("[admin] login lookup failed:", err instanceof Error ? err.message : err);
    return { error: "The database isn't reachable right now. Please try again in a few minutes." };
  }
  if (!admin) {
    return { error: "Invalid email or password." };
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  await createSessionCookie({ sub: admin.id, email: admin.email });
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  await destroySessionCookie();
  redirect("/admin/login");
}
