import { cn } from "@/lib/utils";
import green from "@/assets/ramky-loader-green.png";
import orange from "@/assets/ramky-loader-orange.png";
import ramky from "@/assets/ramky-loader-ramky.png";
import group from "@/assets/ramky-loader-group.png";
import tagline from "@/assets/ramky-loader-tagline.png";

const LAYERS = [
  { src: green, cls: "rbl-green" },
  { src: orange, cls: "rbl-orange" },
  { src: ramky, cls: "rbl-ramky" },
  { src: group, cls: "rbl-group" },
  { src: tagline, cls: "rbl-tagline" },
];

const SIZES = { sm: "w-16", md: "w-28", lg: "w-44" } as const;

/** Logo layers are bundled locally so on-premise servers need no CDN.
 * Branded Ramky Group loader: logo parts reveal in sequence, hold, fade, repeat. */
export function RamkyBrandLoader({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <div aria-hidden className={cn("rbl relative aspect-[1248/1140]", SIZES[size], className)}>
      {LAYERS.map((l) => (
        <img key={l.cls} src={l.src} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = "none"; }} className={cn("rbl-layer absolute inset-0 h-full w-full select-none", l.cls)} />
      ))}
    </div>
  );
}
