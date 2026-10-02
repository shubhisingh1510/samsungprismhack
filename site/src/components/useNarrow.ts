import { useEffect, useState } from "react";

/** True below the desktop breakpoint, where scenes are re-framed rather than shrunk. */
export function useNarrow(query = "(max-width: 1023px)") {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setNarrow(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return narrow;
}
