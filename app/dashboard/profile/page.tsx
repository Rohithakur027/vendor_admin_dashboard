// Legacy /dashboard/profile route. Profile now lives as a tab inside Settings.
// Redirect on the server so existing bookmarks / sidebar deep-links land on
// the new location without flashing the old page.

import { redirect } from "next/navigation";

export default function VendorProfileRedirect() {
  redirect("/dashboard/settings?tab=profile");
}
