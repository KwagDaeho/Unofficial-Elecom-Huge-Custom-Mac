import {
  CONTACT_EMAIL,
  CONTACT_GITHUB_DISPLAY,
  CONTACT_GITHUB_URL,
  CONTACT_KAKAO_DISPLAY,
  CONTACT_URL,
} from "../../constants/contact";
import { APP_VERSION_LABEL } from "../../constants/version";
import { Muted } from "@/components/ui/Muted";
import { usePrefs } from "@/hooks/prefs";
import * as tauri from "../../services/tauri";

import * as styles from "./ContactFooter.css";

export const ContactFooter = () => {
  const { i18n } = usePrefs();
  return (
    <footer className={styles.footer}>
      <p className={styles.credit}>
        <span className={styles.creditBy}>{i18n.creditBy}</span> {i18n.credit}
      </p>
      <Muted>{APP_VERSION_LABEL}</Muted>
      <div className={styles.contactBlock}>
        <strong>{i18n.contactLabel}</strong>
        <p>
          {i18n.emailLabel}{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            onClick={(e) => {
              e.preventDefault();
              void tauri.openUrl(`mailto:${CONTACT_EMAIL}`);
            }}
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p>
          {i18n.kakaoLabel}{" "}
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              e.preventDefault();
              void tauri.openUrl(CONTACT_URL);
            }}
          >
            {CONTACT_KAKAO_DISPLAY}
          </a>
        </p>
        <p>
          {i18n.githubLabel}{" "}
          <a
            href={CONTACT_GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              e.preventDefault();
              void tauri.openUrl(CONTACT_GITHUB_URL);
            }}
          >
            {CONTACT_GITHUB_DISPLAY}
          </a>
        </p>
      </div>
    </footer>
  );
};
