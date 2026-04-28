import { redirect } from "next/navigation";

// The paid "ad-free" tier was retired. Anyone hitting /activate (or its
// success/cancel callbacks) is bounced back to the dashboard so old
// bookmarks and lingering payment-provider redirects don't 404.
export default function ActivatePage() {
  redirect("/dashboard");
}
