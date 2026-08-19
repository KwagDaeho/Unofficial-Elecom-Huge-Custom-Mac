import { usePrefs } from "@/hooks/prefs";
import { useSession } from "@/hooks/session";
import { Button } from "../ui/Button";

export function PermissionPanel() {
  const { i18n } = usePrefs();
  const { grantAccess } = useSession();

  return (
    <section className="panel warn">
      <h2>{i18n.accessibilityTitle}</h2>
      <ol className="perm-steps">
        <li>{i18n.accessibilityStep1}</li>
        <li>{i18n.accessibilityStep2}</li>
        <li>{i18n.accessibilityStep3}</li>
      </ol>
      <div className="row">
        <Button onClick={() => void grantAccess()}>{i18n.grantAccess}</Button>
      </div>
    </section>
  );
}
