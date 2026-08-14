import { AppProviders } from "./providers";
import { AppShell } from "../components/layout/AppShell";

export default function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
