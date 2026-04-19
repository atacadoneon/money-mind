import { test as teardown } from "@playwright/test";
import fs from "fs";
import path from "path";

teardown("cleanup auth", async () => {
  const authFile = path.join(__dirname, ".auth/user.json");
  if (fs.existsSync(authFile)) {
    fs.unlinkSync(authFile);
  }
});
