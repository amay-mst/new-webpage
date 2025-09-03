import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  endpoint: "https://gateway.storjshare.io",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.STORJ_KEY,
    secretAccessKey: process.env.STORJ_SECRET,
  },
  forcePathStyle: true,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!process.env.STORJ_KEY || !process.env.STORJ_SECRET || !process.env.STORJ_BUCKET) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  if (req.method === 'GET') {
    const { action, filename } = req.query;
    
    if (action === 'list') {
      try {
        const result = await client.send(
          new ListObjectsV2Command({ Bucket: process.env.STORJ_BUCKET })
        );
        const files = result.Contents?.map((f) => ({
          name: f.Key,
        })) || [];
        return res.status(200).json({ files });
      } catch (err) {
        return res.status(500).json({ error: "List failed", details: err.message });
      }
    }
    
    if (action === 'download' && filename) {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.STORJ_BUCKET,
          Key: filename,
        });
        const url = await getSignedUrl(client, command, { expiresIn: 3600 });
        return res.status(200).json({ downloadUrl: url });
      } catch (err) {
        return res.status(500).json({ error: "Download failed", details: err.message });
      }
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
