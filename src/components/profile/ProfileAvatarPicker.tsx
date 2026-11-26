"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { Check, FilmSlate, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MOVIE_AVATAR_IDS, MOVIE_AVATARS, movieAvatarSvg, type MovieAvatarId } from "@/lib/movie-avatars";
import { cn } from "@/lib/utils";

interface ProfileAvatarPickerProps {
  value: MovieAvatarId | null;
  onChange: (value: MovieAvatarId | null) => void | Promise<void>;
  fallback?: ReactNode;
  canReset?: boolean;
}

function AvatarArt({ id, size }: { id: MovieAvatarId; size: number }) {
  return <Image src={`data:image/svg+xml,${encodeURIComponent(movieAvatarSvg(id))}`} alt="" width={size} height={size} unoptimized className="size-full rounded-full" />;
}

export function ProfileAvatarPicker({ value, onChange, fallback, canReset }: ProfileAvatarPickerProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const select = async (id: MovieAvatarId | null) => {
    setSaving(true);
    try {
      await onChange(id);
      setOpen(false);
    } catch {
      toast.error("Could not save your avatar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label={value ? `Choose movie avatar (${MOVIE_AVATARS[value].name} selected)` : "Choose movie avatar"} className="flex shrink-0 flex-col items-center gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className={cn("relative grid place-items-center rounded-full border border-border bg-muted transition-colors hover:bg-accent", fallback ? "size-12" : "size-14")}>
            {value ? <AvatarArt id={value} size={56} /> : fallback ?? <FilmSlate className="size-6 text-muted-foreground" />}
            <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center border border-background bg-primary text-primary-foreground">
              <PencilSimple className="size-3" />
            </span>
          </span>
          {!fallback && <span className="text-xs font-medium text-muted-foreground">Choose avatar</span>}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto p-4 sm:max-w-sm sm:p-5">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>Cast yourself</DialogTitle>
          <DialogDescription>Pick a movie avatar for your profile.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-1.5">
          {MOVIE_AVATAR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={value === id}
              disabled={saving}
              onClick={() => select(id)}
              className="group flex min-w-0 flex-col items-center gap-1.5 rounded-md p-1.5 text-center outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent"
            >
              <span className="relative block aspect-square w-full max-w-13">
                <AvatarArt id={id} size={52} />
                {value === id && <span className="absolute right-0 bottom-0 grid size-4 place-items-center rounded-full border border-background bg-primary text-primary-foreground"><Check className="size-2.5" /></span>}
              </span>
              <span className="text-[11px] leading-tight font-medium">{MOVIE_AVATARS[id].name}</span>
            </button>
          ))}
        </div>
        {(value || canReset) && <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => select(null)}>Use default avatar</Button>}
      </DialogContent>
    </Dialog>
  );
}
