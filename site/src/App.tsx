import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { Grain } from "./components/Grain";
import { Nav } from "./components/Nav";
import { Demo } from "./demo/Demo";
import { LanguageProvider } from "./i18n";
import { SharedDefs } from "./illustrations/objects";
import { Adventures } from "./sections/Adventures";
import { Ages } from "./sections/Ages";
import { Closing } from "./sections/Closing";
import { Creator } from "./sections/Creator";
import { Hero } from "./sections/Hero";
import { Home } from "./sections/Home";
import { Idea } from "./sections/Idea";
import { Knock } from "./sections/Knock";
import { Languages } from "./sections/Languages";
import { LivingVideo } from "./sections/LivingVideo";
import { Parents } from "./sections/Parents";
import { Privacy } from "./sections/Privacy";
import { Problem } from "./sections/Problem";
import { SignIn } from "./sections/SignIn";

type View = "story" | "demo" | "signin";

/** The two full-screen pages have their own addresses, so they can be linked and the back button works. */
const viewFromHash = (): View => (location.hash === "#/demo" ? "demo" : location.hash === "#/signin" ? "signin" : "story");

export function App() {
  const [view, setView] = useState<View>(viewFromHash);
  const [exploring, setExploring] = useState(false);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (next: View) => {
    if (next === "story") history.replaceState(null, "", location.pathname + location.search);
    else location.hash = `#/${next}`;
    setView(next);
  };

  return (
    <LanguageProvider>
      <SharedDefs />
      <Grain />
      <Nav onEnter={() => go("demo")} onSignIn={() => go("signin")} doorOpen={exploring} />
      <main>
        <Hero onEnter={() => go("demo")} onPointerActive={setExploring} />
        <Problem />
        <Idea />
        <LivingVideo />
        <Adventures />
        <Home />
        <Knock />
        <Creator />
        <Ages />
        <Languages />
        <Parents />
        <Privacy />
        <Closing onEnter={() => go("demo")} onSignIn={() => go("signin")} />
      </main>
      <AnimatePresence>
        {view === "demo" && <Demo key="demo" onClose={() => go("story")} />}
        {view === "signin" && <SignIn key="signin" onClose={() => go("story")} onEnter={() => go("demo")} />}
      </AnimatePresence>
    </LanguageProvider>
  );
}
