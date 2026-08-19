import { AppShell } from "@/components/layout";
import { AppProviders } from "./providers";
const App = () => {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
};
export default App;
