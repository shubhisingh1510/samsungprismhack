import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import type { ReactNode } from "react";
import { useNarrow } from "../components/useNarrow";
import { At, Books, Box, C, ChildSitting, Door, Ground, Plant, Pot, Sneaker, Star, Telescope, TV } from "./objects";

type Props = { mx: MotionValue<number>; my: MotionValue<number> };

/** One thing in the room. `depth` is how far it shifts with the cursor; `drift` is its slow idle float. */
function Layer({ mx, my, depth, drift = 0, period = 11, children }: Props & { depth: number; drift?: number; period?: number; children: ReactNode }) {
  const still = useReducedMotion();
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth * 0.6);
  return (
    <motion.g style={{ x, y }}>
      <motion.g
        animate={still || !drift ? undefined : { y: [0, -drift, 0] }}
        transition={{ duration: period, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </motion.g>
    </motion.g>
  );
}

export function HeroScene({ mx, my }: Props) {
  const still = useReducedMotion();
  const narrow = useNarrow();
  return (
    // On a phone the frame closes in on the screen, the child and the doorway.
    <svg viewBox={narrow ? "60 110 900 690" : "40 80 1170 720"} className="h-full w-full" role="img"
      aria-label="A child sits by a screen. A doorway of warm light opens from the screen into the room, and through it come a cardboard box, sneakers, books, a telescope, a cooking pot, a plant and stars.">
      <At x={150} y={676}><Ground w={980} fill={C.sage} /></At>

      {/* the screen, small and to one side: it is not the point */}
      <g>
        <path d="M70 610 H330 V640 H70 Z" fill={C.card} />
        <path d="M70 610 H330 V640 H70 Z M92 640 V690 M308 640 V690" stroke={C.ink} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <At x={96} y={440}>
          <TV w={208} h={134}>
            <rect width={190} height={116} fill={C.butter} />
            <path d="M0 96 C40 70 70 84 104 74 C140 64 160 80 190 70 V116 H0 Z" fill={C.honey} />
          </TV>
        </At>
      </g>

      {/* light leaves the screen and becomes a doorway in the room */}
      <path d="M296 452 L560 190 V700 L296 566 Z" fill={C.butter} opacity={0.42} />

      <Layer mx={mx} my={my} depth={9}>
        <motion.g
          style={{ originX: 0.5, originY: 1 }}
          animate={still ? undefined : { scale: [1, 1.014, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          <At x={560} y={150}><Door w={270} h={550} /></At>
          <path d="M640 700 C660 610 700 560 760 520" stroke={C.ivory} strokeWidth={26} strokeLinecap="round" fill="none" opacity={0.7} />
          <At x={640} y={250} s={1.1}><Star fill={C.ivory} /></At>
          <At x={742} y={318} s={0.7}><Star fill={C.ivory} /></At>
          <At x={690} y={398} s={0.5}><Star fill={C.ivory} /></At>
        </motion.g>
      </Layer>

      <g>
        <At x={340} y={520} s={1.62}><ChildSitting /></At>
      </g>

      {/* the world, arriving */}
      <Layer mx={mx} my={my} depth={-16} drift={5} period={12}>
        <At x={980} y={250} s={1.5}><g><Telescope /></g></At>
      </Layer>
      <Layer mx={mx} my={my} depth={-22} drift={4} period={10}>
        <At x={800} y={560} s={1.25}><g><Box /></g></At>
      </Layer>
      <Layer mx={mx} my={my} depth={-14} drift={6} period={14}>
        <At x={850} y={436} s={0.95}><g><Pot /></g></At>
      </Layer>
      <Layer mx={mx} my={my} depth={-28} drift={3} period={9}>
        <At x={952} y={596} s={0.98}><g><Books /></g></At>
      </Layer>
      <Layer mx={mx} my={my} depth={-34} drift={4} period={13}>
        <At x={676} y={668} s={0.86} r={-6}><g><Sneaker /></g></At>
        <At x={760} y={690} s={0.8} r={4}><g><Sneaker color={C.powder} /></g></At>
      </Layer>
      <Layer mx={mx} my={my} depth={-12} drift={3} period={15}>
        <At x={1080} y={560} s={1.3}><g><Plant /></g></At>
      </Layer>
      <Layer mx={mx} my={my} depth={-40} drift={8} period={16}>
        <At x={900} y={170} s={1.5}><Star /></At>
        <At x={1110} y={120} s={1}><Star /></At>
        <At x={1150} y={300} s={0.7}><Star fill={C.terracotta} /></At>
      </Layer>
    </svg>
  );
}
