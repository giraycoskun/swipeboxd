"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Robot, Trash } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";

import { SettingsSection } from "./SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAdminStatus, useSession } from "@/hooks/api";
import { apiClient } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import type { AgentScope, AgentTokenRecord } from "@/types/agent";

const SCOPES: Array<{ value: AgentScope; label: string; description: string }> = [
  { value: "read", label: "Read", description: "Status, libraries, decks" },
  { value: "write", label: "Write", description: "Read, plus settings and cache" },
  { value: "admin", label: "Admin", description: "Write, plus destructive changes" },
];

export function AgentSettings() {
    const { data: sessionStatus } = useSession();
    const { data: adminStatus } = useAdminStatus();

    const [tokens, setTokens] = useState<AgentTokenRecord[]>([]);
    const [name, setName] = useState("");
    const [scope, setScope] = useState<AgentScope>("read");
    const [created, setCreated] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const isAdmin = !!adminStatus?.isAdmin && !sessionStatus?.isGuest;

    const load = useCallback(async () => {
        try {
            const response = await apiClient.get("/api/agent-tokens");
            setTokens(response.data?.tokens ?? []);
        } catch {
            // A failed list is not worth a toast on every sheet open.
        }
    }, []);

    useEffect(() => {
        if (isAdmin) void load();
    }, [isAdmin, load]);

    if (!isAdmin) return null;

    const create = async () => {
        if (!name.trim()) return;
        setBusy(true);
        try {
            const response = await apiClient.post("/api/agent-tokens", { name: name.trim(), scope });
            setCreated(response.data.token);
            setName("");
            await load();
        } catch (error) {
            toast.error("Could not create the token", { description: getErrorMessage(error) });
        } finally {
            setBusy(false);
        }
    };

    const revoke = async (token: AgentTokenRecord) => {
        setBusy(true);
        try {
            await apiClient.delete(`/api/agent-tokens/${token.id}`);
            toast.success(`Revoked "${token.name}"`);
            await load();
        } catch (error) {
            toast.error("Could not revoke the token", { description: getErrorMessage(error) });
        } finally {
            setBusy(false);
        }
    };

    const copy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success("Copied");
        } catch {
            toast.error("Copy failed — select the text instead");
        }
    };

    return (
        <SettingsSection title="Agents">
            <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                    An agent can drive this instance through the CLI that ships in the container. No setup:
                    the container mints a local token for an administrator.
                </p>
                <button
                    onClick={() => copy("docker exec <container> messer-swipe status")}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted"
                >
                    <span className="truncate">docker exec &lt;container&gt; messer-swipe status</span>
                    <Copy className="size-3.5 shrink-0" />
                </button>
            </div>

            {created && (
                <div className="space-y-2 rounded-md border border-input p-3">
                    <div className="flex items-center gap-2 text-xs font-medium">
                        <Robot className="size-4" /> Shown once — copy it now
                    </div>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-[11px]">
                            {created}
                        </code>
                        <Button variant="secondary" size="sm" onClick={() => copy(created)}>
                            <Copy className="size-3.5" />
                        </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        MESSER_SWIPE_TOKEN for a client outside the container. Never paste it into an issue.
                    </p>
                </div>
            )}

            <div className="space-y-2">
                {tokens.length === 0 ? (
                    <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
                        No tokens yet
                    </div>
                ) : (
                    tokens.map((token) => (
                        <div key={token.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium">{token.name}</span>
                                    <Badge variant="meta">{token.scope}</Badge>
                                    {token.isLocal && <Badge variant="meta">local</Badge>}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    <span className="font-mono">{token.prefix}</span>
                                    {" · "}
                                    {token.lastUsedAt
                                        ? `used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                                        : "never used"}
                                    {token.revokedAt ? " · revoked" : ""}
                                </div>
                            </div>
                            {!token.revokedAt && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => revoke(token)}
                                    disabled={busy}
                                    aria-label={`Revoke ${token.name}`}
                                >
                                    <Trash className="size-4" />
                                </Button>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="space-y-2 border-t pt-3">
                <div className="text-xs font-medium">New token</div>
                <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. laptop"
                    className="h-8 text-sm"
                    maxLength={60}
                />
                <div className="grid gap-1.5">
                    {SCOPES.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setScope(option.value)}
                            className={
                                "flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors " +
                                (scope === option.value
                                    ? "border-foreground/40 bg-accent font-medium"
                                    : "border-input text-muted-foreground hover:bg-muted/50")
                            }
                        >
                            <span>{option.label}</span>
                            <span className="text-[10px] uppercase tracking-wider opacity-60">{option.description}</span>
                        </button>
                    ))}
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={create}
                    disabled={busy || !name.trim()}
                >
                    <Plus className="size-3.5" /> Create token
                </Button>
            </div>
        </SettingsSection>
    );
}
