"use client"

import { X, Heart, Star } from "lucide-react"

export function SwipeButtons({
  onSwipeLeft,
  onSwipeRight,
  onSuperLike,
}: {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  onSuperLike: () => void
}) {
  return (
    <div className="flex items-center justify-center gap-6 py-5">
      <button
        onClick={onSwipeLeft}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-secondary text-muted-foreground transition-all hover:scale-105 active:scale-95"
        aria-label="Pass"
        type="button"
      >
        <X className="w-6 h-6" />
      </button>

      <button
        onClick={onSuperLike}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary text-primary transition-all hover:scale-105 active:scale-95"
        aria-label="Super Like"
        type="button"
      >
        <Star className="w-5 h-5" />
      </button>

      <button
        onClick={onSwipeRight}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground transition-all hover:scale-105 active:scale-95"
        aria-label="Like"
        type="button"
      >
        <Heart className="w-6 h-6" />
      </button>
    </div>
  )
}
