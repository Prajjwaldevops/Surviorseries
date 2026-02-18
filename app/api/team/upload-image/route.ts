import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

/**
 * POST /api/team/upload-image
 * Uploads team image to R2 but does NOT auto-approve. AdminX must approve separately.
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const teamId = formData.get("teamId") as string | null;

        if (!teamId || !file) {
            return NextResponse.json({ error: "teamId and file are required" }, { status: 400 });
        }

        const { data: team, error: fetchError } = await supabase
            .from("teams")
            .select("*")
            .eq("team_id", teamId)
            .single();

        if (fetchError || !team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        // Get current round
        const { data: gameState } = await supabase.from("game_state").select("current_round").single();
        const currentRound = gameState?.current_round || 1;

        // Upload to R2
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const fileExt = file.name.split(".").pop() || "jpg";
        const key = `teams/${teamId}/r${currentRound}-${Date.now()}.${fileExt}`;

        await r2.send(
            new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME!,
                Key: key,
                Body: fileBuffer,
                ContentType: file.type || "image/jpeg",
            })
        );

        const imageUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

        const imageData = {
            cloudflare_url: imageUrl,
            r2_key: key,
            team_id: team.team_id,
            team_name: team.name,
            members: team.members.map((m: { name: string; email: string; userId: string }) => ({
                name: m.name,
                email: m.email,
                userId: m.userId,
            })),
            uploaded_at: new Date().toISOString(),
            round: currentRound,
        };

        // Update round_image_urls
        const roundImageUrls = team.round_image_urls || {};
        roundImageUrls[`r${currentRound}`] = imageUrl;

        // Update team — NO auto-approval
        const { error: updateError } = await supabase
            .from("teams")
            .update({
                image_url: imageUrl,
                image_data: imageData,
                image_approved: false,
                round_image_urls: roundImageUrls,
            })
            .eq("team_id", teamId);

        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            imageUrl,
            imageData,
            message: "Image uploaded. Waiting for AdminX approval.",
        });
    } catch (err) {
        console.error("Team upload error:", err);
        return NextResponse.json({ error: "Failed to upload team image" }, { status: 500 });
    }
}
