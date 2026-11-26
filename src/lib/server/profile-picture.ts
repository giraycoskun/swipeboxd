import sharp from "sharp";
import { db, userProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { movieAvatarSvg, type MovieAvatarId } from "@/lib/movie-avatars";

export async function saveProfileAvatar(userId: string, avatarId: MovieAvatarId) {
    const processedImage = await sharp(Buffer.from(movieAvatarSvg(avatarId))).webp().toBuffer();

    const updatedAt = new Date().toISOString();

    await db.insert(userProfiles)
        .values({
            userId,
            image: processedImage,
            contentType: 'image/webp',
            updatedAt,
        })
        .onConflictDoUpdate({
            target: userProfiles.userId,
            set: {
                image: processedImage,
                contentType: 'image/webp',
                updatedAt,
            }
        });

    return { success: true };
}

export async function getProfilePicture(userId: string) {
    const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
    });

    return profile;
}

export async function deleteProfilePicture(userId: string) {
    await db.delete(userProfiles).where(eq(userProfiles.userId, userId));
    return { success: true };
}
