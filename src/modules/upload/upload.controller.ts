import { Request, Response } from 'express';
import cloudinary from '../../config/cloudinary.js';

export const uploadMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Convert buffer to Base64 to stream directly into Cloudinary without saving locally
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    let dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const cldRes = await cloudinary.uploader.upload(dataURI, {
      resource_type: 'auto',
      folder: 'wassup_chat_app_media'
    });

    res.status(200).json({ url: cldRes.secure_url, format: cldRes.format, type: cldRes.resource_type });
  } catch (error: any) {
    console.error('Error uploading to Cloudinary:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
