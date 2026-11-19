import { cn } from "@/lib/utils";

interface SettingsSectionProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

export function SettingsSection({ title, children, className }: SettingsSectionProps) {
    return (
        <section className={cn(
            // A settings sheet mounts every section at once, and only the first fits the
            // screen. `content-visibility: auto` keeps the browser from laying out and
            // painting the rest on the frame the sheet opens — that mount was a 156 ms
            // long task, i.e. the open animation dropping frames.
            "[content-visibility:auto] [contain-intrinsic-size:auto_420px]",
            className
        )}>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                {title}
            </h3>
            <div className="space-y-4">
                {children}
            </div>
        </section>
    );
}
