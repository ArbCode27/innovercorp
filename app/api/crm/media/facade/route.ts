import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/api/crm/_lib/supabase-admin";
import {
  assertFacadeImageFile,
  FacadeImageError,
  facadeImageExtension,
} from "@/lib/facade-image";

export const dynamic = "force-dynamic";

const DEFAULT_STORAGE_BUCKET = "whatsapp-media";

const resolveImageBucket = () =>
  process.env.SUPABASE_WHATSAPP_IMAGE_BUCKET ||
  process.env.SUPABASE_WHATSAPP_MEDIA_BUCKET ||
  DEFAULT_STORAGE_BUCKET;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Debes adjuntar una imagen" },
        { status: 400 },
      );
    }

    const file = assertFacadeImageFile(image);
    const extension = facadeImageExtension(file.type);
    const storagePath = `facades/${Date.now()}-${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = getSupabaseAdmin();
    const bucket = resolveImageBucket();

    const { error: storageError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      console.error("[FACADE] upload_failed", storageError);
      return NextResponse.json(
        { error: "No se pudo guardar la foto de fachada" },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    if (!publicUrl) {
      return NextResponse.json(
        { error: "No se obtuvo la URL de la fachada" },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    if (error instanceof FacadeImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[FACADE] upload_error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo subir la foto de fachada",
      },
      { status: 500 },
    );
  }
}
