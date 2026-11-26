"use client";

import { useState } from "react";
import {
  Shield,
  UserPlus,
  Globe,
} from "@phosphor-icons/react/dist/ssr";
import { SettingsSection } from "./SettingsSection";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SmoothAvatar } from "@/components/ui/smooth-avatar";
import { useSession } from "@/hooks/api";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { ProfileAvatarPicker } from "../../profile/ProfileAvatarPicker";
import type { MovieAvatarId } from "@/lib/movie-avatars";
import { apiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useUserStore } from "@/lib/user-store";
import { ProviderType } from "@/lib/providers/types";

export function AccountSettings() {
    const { data: sessionStatus, isLoading } = useSession();
    const runtimeConfig = useRuntimeConfig();
    const queryClient = useQueryClient();
    const { notifyProfileUpdate } = useUserStore();
    const [avatarId, setAvatarId] = useState<MovieAvatarId | null>(null);


    if (isLoading || !sessionStatus) {
        return (
            <SettingsSection title="Account">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                </div>
            </SettingsSection>
        );
    }

    const { userName, userId, isGuest, isAdmin, provider, hasCustomProfilePicture } = sessionStatus;
    const { capabilities, provider: runtimeProvider } = runtimeConfig;
    const activeProvider = provider || runtimeProvider;

    const handleAvatarChange = async (id: MovieAvatarId | null) => {
        if (id) await apiClient.post("/api/user/profile-picture", { avatarId: id });
        else await apiClient.delete("/api/user/profile-picture");
        setAvatarId(id);
        queryClient.invalidateQueries({ queryKey: ["session"] });
        notifyProfileUpdate();
    };

    return (
        <SettingsSection title="Profile">
            <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/50">
                <ProfileAvatarPicker
                    value={avatarId}
                    onChange={handleAvatarChange}
                    canReset={hasCustomProfilePicture}
                    fallback={<SmoothAvatar className="size-full" userId={userId} userName={userName} hasImage={hasCustomProfilePicture} />}
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-base font-medium truncate">{userName}</span>
                        {isAdmin && (
                            <Badge variant='outline' className="text-[10px] h-4 px-1.5 font-semibold uppercase tracking-wider">
                                Admin
                            </Badge>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {isGuest ? (
                            <>
                                <UserPlus className="size-3" />
                                Guest Account
                            </>
                        ) : !capabilities.hasAuth ? (
                            <>
                                <Globe className="size-3" />
                                Universal Profile
                            </>
                        ) : (
                            <>
                                <Shield className="size-3" />
                                {activeProvider === ProviderType.TMDB ? activeProvider.toUpperCase() + ' Profile' : activeProvider.charAt(0).toUpperCase() + activeProvider.slice(1) + ' Account'}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </SettingsSection>
    );
}
