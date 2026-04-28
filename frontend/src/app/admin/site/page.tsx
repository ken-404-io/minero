import { apiJson } from "@/lib/api";
import AdminSiteClient from "./AdminSiteClient";

type SiteConfig = {
  maintenanceMode: boolean;
  announcementBanner: string;
  registrationEnabled: boolean;
  claimsEnabled: boolean;
  withdrawalsEnabled: boolean;
};

type ConfigResponse = { config: SiteConfig };

export default async function AdminSitePage() {
  const data = await apiJson<ConfigResponse>("/admin/config");
  const config: SiteConfig = data?.config ?? {
    maintenanceMode: false,
    announcementBanner: "",
    registrationEnabled: true,
    claimsEnabled: true,
    withdrawalsEnabled: true,
  };

  return <AdminSiteClient config={config} />;
}
