"use client";

import { useState, useEffect } from "react"; // Added useEffect
import Image, { ImageLoaderProps, ImageProps } from "next/image";
import { cn } from "@/lib/utils";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { useBlurData } from "@/hooks/use-blur-data";
import { DEFAULT_MAX_IMAGE_WIDTH, DEFAULT_IMAGE_QUALITY, normalizeImageWidth } from "@/lib/image-request";
import {
  ImageBroken,
} from "@phosphor-icons/react/dist/ssr";

import { Skeleton } from "./skeleton";

// 1. Create a global set to track loaded images outside the component
const loadedImageCache = new Set<string>();

interface OptimizedImageProps extends Omit<ImageProps, "onLoad"> {
  containerClassName?: string;
  onLoad?: (e: any) => void;
  externalId?: string;
  imageType?: string;
}

export function OptimizedImage({
  className,
  containerClassName,
  src,
  alt = "",
  width,
  height,
  fill,
  priority,
  onLoad,
  placeholder,
  blurDataURL: initialBlurDataURL,
  externalId,
  imageType,
  ...props
}: OptimizedImageProps) {
  // The instance decides how large a poster may get: the deck's `sizes` is a
  // CSS request, and on a 3× phone it becomes 1344 px, which Jellyfin then
  // re-encodes per card (issue #94). `maxImageWidth` caps it server-side too.
  const { basePath, maxImageWidth = DEFAULT_MAX_IMAGE_WIDTH } = useRuntimeConfig();

  // Helper to get string version of src
  const srcString = typeof src === "string" ? src : "";
  const resolvedSrc = srcString.startsWith("/") && !srcString.startsWith(basePath)
    ? `${basePath}${srcString}`
    : src;

  const isFill = fill ?? (!width && !height);
  const isMediaImage = !!externalId || (typeof src === "string" && (src.startsWith("/api/media/image") || src.startsWith(`${basePath}/api/media/image`)));

  // 2. Initialize state based on whether the image is in our global cache
  const sizeKey = isFill
    ? `fill:${props.sizes || "auto"}`
    : `${width || "auto"}x${height || "auto"}`;
  const qualityKey = props.quality ? `q${props.quality}` : "";
  const cacheKey = typeof resolvedSrc === "string"
    ? `${resolvedSrc}::${sizeKey}${qualityKey ? `::${qualityKey}` : ""}`
    : "";
  const [isLoading, setIsLoading] = useState(!loadedImageCache.has(cacheKey));
  const [hasError, setHasError] = useState(false);

  const blurDataURL = useBlurData(externalId, initialBlurDataURL, imageType);

  const imageLoader = ({ src, width, quality }: ImageLoaderProps) => {
    const normalizedWidth = normalizeImageWidth(width, maxImageWidth);
    return `${src}${src.includes("?") ? "&" : "?"}width=${normalizedWidth}&quality=${quality || DEFAULT_IMAGE_QUALITY}`;
  };

  const handleLoad = (e: any) => {
    // 4. Add to cache once loaded
    if (cacheKey) {
      loadedImageCache.add(cacheKey);
    }
    setIsLoading(false);
    onLoad?.(e);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  return (
    <div className={cn("relative overflow-hidden bg-muted/20", containerClassName || className)}>
      {!hasError && (
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-400",
            isLoading ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {blurDataURL ? (
            // No `filter: blur()` here on purpose: the placeholder is generated blurred
            // and small (see lib/image-placeholder.ts), so a 40 px CSS blur on top of it
            // would cost a full-card paint layer per card, and this one sits inside the
            // element being dragged (#101).
            <div
              className="absolute inset-0 bg-cover bg-center scale-102"
              style={{ backgroundImage: `url(${blurDataURL})` }}
            />
          ) : (
            <Skeleton className="w-full h-full" />
          )}
        </div>
      )}

      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10">
          <ImageBroken className="w-8 h-8 text-muted-foreground" />
        </div>
      ) : (
        <Image
          {...props}
          loader={isMediaImage ? imageLoader : undefined}
          src={resolvedSrc}
          alt={alt}
          width={isFill ? undefined : width}
          height={isFill ? undefined : height}
          fill={isFill}
          priority={priority}
          className={cn(
            // `transition-all` also animates filter/colour, which the drag path pays
            // for on every property change; only opacity/transform move here.
            "duration-400 ease-in-out transition-[opacity,transform]",
            isLoading ? "opacity-0 scale-102" : "opacity-100 scale-100",
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
}
