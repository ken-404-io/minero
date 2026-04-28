import { redirect } from "next/navigation";

// Legacy callback target from the (now retired) paid tier flow.
export default function ActivateSuccessPage() {
  redirect("/dashboard");
}
