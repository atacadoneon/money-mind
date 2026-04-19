// Root page — middleware redirects authenticated users to /inicio
// Unauthenticated users see the marketing landing at /landing
import { redirect } from "next/navigation";
export default function Home() {
  // Middleware handles auth. If we reach here, we redirect to landing.
  redirect("/landing");
}
