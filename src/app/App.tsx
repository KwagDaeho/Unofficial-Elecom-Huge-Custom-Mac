import { AppShell } from "@/components/layout";
import { AppProviders } from "./providers";

export default function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
