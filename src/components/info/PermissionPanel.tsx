import type { Dict } from "../../i18n";

export function PermissionPanel({
  i18n,
  onGrant,
}: {
  i18n: Dict;
  onGrant: () => void | Promise<void>;
}) {
  return (
    <section className="panel warn">
      <h2>{i18n.accessibilityTitle}</h2>
      <ol className="perm-steps">
        <li>{i18n.accessibilityStep1}</li>
        <li>{i18n.accessibilityStep2}</li>
        <li>{i18n.accessibilityStep3}</li>
      </ol>
      <div className="row">
        <button type="button" onClick={() => void onGrant()}>
          {i18n.grantAccess}
        </button>
      </div>
    </section>
  );
}
