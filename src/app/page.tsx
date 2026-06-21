import { redirect } from "next/navigation";

// The root simply routes into the app; middleware sends unauthenticated users
// to /login.
export default function RootPage() {
  redirect("/dashboard");
}
