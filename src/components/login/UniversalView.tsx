import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { ProfileAvatarPicker } from "../profile/ProfileAvatarPicker";
import type { MovieAvatarId } from "@/lib/movie-avatars";

interface UniversalViewProps {
  isLetterboxd?: boolean;
  providerLock: boolean;
  watchlistUsername: string;
  setWatchlistUsername: (val: string) => void;
  tmdbToken: string;
  setTmdbToken: (val: string) => void;
  username: string;
  setUsername: (val: string) => void;
  loading: boolean;
  handleLogin: (e: React.FormEvent) => void;
  isJoining?: boolean;
  avatarId: MovieAvatarId | null;
  onAvatarChange: (avatarId: MovieAvatarId | null) => void;
}

export function UniversalView({
  isLetterboxd,
  providerLock,
  watchlistUsername,
  setWatchlistUsername,
  tmdbToken,
  setTmdbToken,
  username,
  setUsername,
  loading,
  handleLogin,
  isJoining,
  avatarId,
  onAvatarChange,
}: UniversalViewProps) {
  const needsWatchlistUsername = isLetterboxd && !providerLock && !isJoining;
  return (
    <div className="space-y-2">
      <form onSubmit={handleLogin} className="space-y-2">
        <div className="flex justify-center pb-2">
          <ProfileAvatarPicker value={avatarId} onChange={onAvatarChange} />
        </div>

        <CardDescription>
          {isJoining
            ? "Enter a display name to join the session"
            : needsWatchlistUsername ? "Enter the Letterboxd username for a public watchlist"
            : isLetterboxd ? "Enter a display name to swipe on the Letterboxd watchlist" : (providerLock
              ? "Enter a name to start swiping"
              : "Configure TMDB and enter a name")}
        </CardDescription>

        {needsWatchlistUsername && (
          <div className="space-y-1">
            <label htmlFor="watchlist-username" className="text-sm font-medium">Letterboxd username</label>
            <Input
              id="watchlist-username"
              placeholder="e.g. giraycoskun"
              value={watchlistUsername}
              onChange={(e) => setWatchlistUsername(e.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              maxLength={64}
              required
            />
          </div>
        )}

        {!isLetterboxd && !providerLock && !isJoining && (
          <PasswordInput
            placeholder="TMDB API Read Access Token"
            value={tmdbToken}
            onChange={(e) => setTmdbToken(e.target.value)}
            className="h-8"
            inputClassName="text-xs"
          />
        )}

        <div className="space-y-1">
          {needsWatchlistUsername && <label htmlFor="display-name" className="text-sm font-medium">Display name</label>}
          <Input
            id="display-name"
            placeholder="Display name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-muted border-input"
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full font-semibold mt-4" disabled={loading || !username.trim() || (needsWatchlistUsername && !watchlistUsername.trim())}>
          {loading ? (isJoining ? "Joining..." : "Starting...") : (isJoining ? "Join" : "Start")}
        </Button>
      </form>
    </div>
  );
}
