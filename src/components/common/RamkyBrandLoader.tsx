import { cn } from "@/lib/utils";
import green from "@/assets/ramky-loader-green.png.asset.json";
import orange from "@/assets/ramky-loader-orange.png.asset.json";
import ramky from "@/assets/ramky-loader-ramky.png.asset.json";
import group from "@/assets/ramky-loader-group.png.asset.json";
import tagline from "@/assets/ramky-loader-tagline.png.asset.json";

const LAYERS = [
  { src: green.url, cls: "rbl-green" },
  { src: orange.url, cls: "rbl-orange" },
  { src: ramky.url, cls: "rbl-ramky" },
  { src: group.url, cls: "rbl-group" },
  { src: tagline.url, cls: "rbl-tagline" },
];

const SIZES = { sm: "w-16", md: "w-28", lg: "w-44" } as const;

/** Branded Ramky Group loader: logo parts reveal in sequence, hold, fade, repeat. */
export function RamkyBrandLoader({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <div aria-hidden className={cn("rbl relative aspect-[1248/1140]", SIZES[size], className)}>
      {LAYERS.map((l) => (
        <img key={l.cls} src={l.src} alt="" draggable={false} className={cn("rbl-layer absolute inset-0 h-full w-full select-none", l.cls)} />
      ))}
    </div>
  );
}
