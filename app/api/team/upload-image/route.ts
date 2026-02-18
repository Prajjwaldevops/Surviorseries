import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cloudflare R2 client (S3-compatible)
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
 * Receives image file + teamId, uploads to Cloudflare R2, stores URL + team data in Supabase.
 * Body: FormData with "file" (image) and "teamId" (string)
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const teamId = formData.get("teamId") as string | null;

        if (!teamId || !file) {
            return NextResponse.json(
                { error: "teamId and file are required" },
                { status: 400 }
            );
        }

        // Fetch the team to build image_data
        const { data: team, error: fetchError } = await supabase
            .from("teams")
            .select("*")
            .eq("team_id", teamId)
            .single();

        if (fetchError || !team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        // Upload to Cloudflare R2
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const fileExt = file.name.split(".").pop() || "jpg";
        const key = `teams/${teamId}/${Date.now()}.${fileExt}`;

        await r2.send(
            new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME!,
                Key: key,
                Body: fileBuffer,
                ContentType: file.type || "image/jpeg",
            })
        );

        // Build the public URL
        const imageUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

        // Build image_data: R2 URL + team ID + members details + emails
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
        };

        // Update team: set image_url, image_data, and approve the team
        const { error: updateError } = await supabase
            .from("teams")
            .update({
                image_url: imageUrl,
                image_data: imageData,
                approved: true,
            })
            .eq("team_id", teamId);

        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            approved: true,
            imageUrl,
            imageData,
        });
    } catch (err) {
        console.error("Team upload error:", err);
        return NextResponse.json(
            { error: "Failed to upload team image" },
            { status: 500 }
        );
    }
}
