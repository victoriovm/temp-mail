import { Mail } from "lucide-react"

import { cn } from "@/lib/utils"

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="brand-mark">
        <Mail className="size-[18px]" strokeWidth={2.4} />
      </span>
      <span className="text-lg font-bold tracking-[-0.04em]">Temp Mail</span>
    </div>
  )
}
