
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false, // Disable response limit for streaming
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set streaming headers
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const client = new S3Client({
    endpoint: "https://gateway.storjshare.io",
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.STORJ_KEY,
      secretAccessKey: process.env.STORJ_SECRET,
    },
  });

  try {
    const form = formidable({ 
      multiples: false,
      maxFileSize: 100 * 1024 * 1024, // 100MB limit
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        res.write(`Error: ${err.message}\n`);
        return res.end();
      }

      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      
      if (!file) {
        res.write('Error: No file uploaded\n');
        return res.end();
      }

      // Stream progress updates
      res.write(`Starting upload: ${file.originalFilename}\n`);
      res.write(`File size: ${file.size} bytes\n`);

      try {
        const fileStream = fs.createReadStream(file.filepath);
        
        const upload = new Upload({
          client,
          params: {
            Bucket: "my-app-files",
            Key: file.originalFilename,
            Body: fileStream,
            ContentType: file.mimetype,
          }
        });

        // Track upload progress
        upload.on("httpUploadProgress", (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          res.write(`Progress: ${percent}%\n`);
        });

        const result = await upload.done();
        res.write(`Upload completed: ${result.Location}\n`);
        res.end();

      } catch (uploadError) {
        res.write(`Upload failed: ${uploadError.message}\n`);
        res.end();
      }
    });

  } catch (error) {
    res.write(`Error: ${error.message}\n`);
    res.end();
  }
}
