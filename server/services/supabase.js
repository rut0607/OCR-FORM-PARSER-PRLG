const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    realtime: {
      transport: ws,
    },
  }
);

async function uploadToSupabase(fileBuffer, originalName) {
  const bucket = process.env.SUPABASE_BUCKET;
  const fileName = `${Date.now()}_${originalName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  if (!urlData || !urlData.publicUrl) {
    throw new Error("Supabase: failed to retrieve public URL");
  }

  return { publicUrl: urlData.publicUrl, fileName };
}

module.exports = { uploadToSupabase };
