import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 is S3-compatible
// You need to set these environment variables:
// - R2_ACCOUNT_ID: Your Cloudflare account ID
// - R2_ACCESS_KEY_ID: R2 API token access key
// - R2_SECRET_ACCESS_KEY: R2 API token secret key
// - R2_BUCKET_NAME: Your R2 bucket name
// - R2_PUBLIC_URL: Public URL for the bucket (if using custom domain or R2.dev subdomain)

const accountId = process.env.R2_ACCOUNT_ID;

if (!accountId) {
  console.warn("R2_ACCOUNT_ID is not set. Image uploads will not work.");
}

export const r2Client = new S3Client({
  region: "auto",
  endpoint: accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : undefined,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "myxploit-images";
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";
