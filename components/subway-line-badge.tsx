const lineColors: Record<string, string> = {
  "1": "bg-[hsl(0,72%,51%)] text-white",
  "2": "bg-[hsl(0,72%,51%)] text-white",
  "3": "bg-[hsl(0,72%,51%)] text-white",
  "4": "bg-[hsl(145,63%,42%)] text-white",
  "5": "bg-[hsl(145,63%,42%)] text-white",
  "6": "bg-[hsl(145,63%,42%)] text-white",
  "7": "bg-[hsl(300,36%,45%)] text-white",
  A: "bg-[hsl(214,80%,42%)] text-white",
  C: "bg-[hsl(214,80%,42%)] text-white",
  E: "bg-[hsl(214,80%,42%)] text-white",
  B: "bg-[hsl(28,90%,52%)] text-white",
  D: "bg-[hsl(28,90%,52%)] text-white",
  F: "bg-[hsl(28,90%,52%)] text-white",
  M: "bg-[hsl(28,90%,52%)] text-white",
  G: "bg-[hsl(100,50%,45%)] text-white",
  J: "bg-[hsl(35,30%,38%)] text-white",
  Z: "bg-[hsl(35,30%,38%)] text-white",
  L: "bg-[hsl(0,0%,40%)] text-white",
  N: "bg-[hsl(45,100%,51%)] text-[hsl(220,25%,10%)]",
  Q: "bg-[hsl(45,100%,51%)] text-[hsl(220,25%,10%)]",
  R: "bg-[hsl(45,100%,51%)] text-[hsl(220,25%,10%)]",
  W: "bg-[hsl(45,100%,51%)] text-[hsl(220,25%,10%)]",
  S: "bg-[hsl(0,0%,50%)] text-white",
}

export function SubwayLineBadge({ line, size = "md" }: { line: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold ${lineColors[line] || "bg-muted text-foreground"} ${sizeClasses[size]}`}
      aria-label={`${line} train line`}
    >
      {line}
    </span>
  )
}
