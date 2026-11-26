import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/session";
import { SessionData } from "@/types";
import { saveProfileAvatar, deleteProfilePicture } from "@/lib/server/profile-picture";
import { handleApiError } from "@/lib/api-utils";
import { profileAvatarSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());

    if (!session.isLoggedIn || !session.user?.Id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
        return NextResponse.json({ message: "Choose a movie avatar. Image uploads are not supported." }, { status: 415 });
    }
    const choice = profileAvatarSchema.safeParse(await request.json().catch(() => null));
    if (!choice.success) {
        return NextResponse.json({ message: "Choose an available movie avatar." }, { status: 400 });
    }

    try {
        await saveProfileAvatar(session.user.Id, choice.data.avatarId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return handleApiError(error, "Could not save avatar");
    }
}

export async function DELETE(request: NextRequest) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());

    if (!session.isLoggedIn || !session.user?.Id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        await deleteProfilePicture(session.user.Id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return handleApiError(error, "Delete failed");
    }
}
