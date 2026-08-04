import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { ProfileView } from "@/components/profile/profile-view";

export default async function ProfilePage() {
  const t = await getTranslations("Profile");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} description={t("description")} />
      <ProfileView />
    </div>
  );
}
