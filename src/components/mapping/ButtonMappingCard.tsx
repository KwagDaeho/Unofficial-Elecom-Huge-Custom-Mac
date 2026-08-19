import { BindingRow } from "./BindingRow";
import { buttonLabel } from "@/i18n";
import { asBinding } from "@/domain/profile";
import { usePrefs, useProfileCtx, useEditor } from "@/hooks";
import type { ButtonMeta, Profile } from "@/types";

interface ButtonMappingCardProps {
  buttonMeta: ButtonMeta;
  profile: Profile;
}

export function ButtonMappingCard(props: ButtonMappingCardProps) {
  const { lang, i18n } = usePrefs();
  const { mappings } = useProfileCtx();
  const { catalogSelection } = useEditor();
  const { buttonMeta, profile } = props;
  const binding = asBinding(profile.buttons[buttonMeta.id]);

  return (
    <div className="button-card">
      <BindingRow
        target={{ kind: "button", id: buttonMeta.id }}
        binding={binding}
        buttonId={buttonMeta.id}
        label={
          <>
            {buttonLabel(buttonMeta.id, lang)}
            {buttonMeta.hiddenFromMacos ? <em>{i18n.rawHid}</em> : null}
          </>
        }
        onFlags={(patch) => mappings.updateButtonFlags(buttonMeta.id, patch)}
        onPick={(slot, value) =>
          catalogSelection.selectButton(buttonMeta.id, slot, value)
        }
      />
    </div>
  );
}
