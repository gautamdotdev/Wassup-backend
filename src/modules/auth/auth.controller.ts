import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../users/user.model.js';
import generateTokenAndSetCookie from '../../utils/generateToken.js';
import transporter from '../../utils/mailer.js';
import { catchAsync, AppError } from '../../utils/errors.js';
import config from '../../config/env.config.js';

/**
 * POST /auth/request-otp
 * Body: { email }
 * Response includes `userExists` flag so frontend knows whether to ask for name.
 */
export const requestOtp = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Please provide an email', 400);
    }

    const existingUser = await User.findOne({ email });
    // A '__pending__' record means the user started registration but never completed it
    const userExists = !!existingUser && existingUser.name !== '__pending__';

    // For new users we do NOT create the record yet — they still need to supply their name.
    // We'll use a temporary "guest" document to store the OTP if user doesn't exist.
    let target = (existingUser && existingUser.name !== '__pending__') ? existingUser : null;

    if (!target) {
      if (existingUser) {
        // Reuse the existing pending placeholder
        target = existingUser;
      } else {
        // Create a temporary, nameless user placeholder just to hold the OTP.
        // The name will be set properly during verifyOtp.
        target = new User({
          name: '__pending__',
          email,
        });
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    target.otp = hashedOtp;
    target.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await target.save();

    // Send Email
    const mailOptions = {
        from: config.smtp.from,
        to: email,
        subject: 'Your Wassup OTP',
        text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px;border-radius:12px;background:#f9f9f9;">
            <h2 style="margin-bottom:8px;color:#111;">Your Wassup OTP</h2>
            <p style="color:#555;font-size:14px;">Use the code below to ${userExists ? 'log in' : 'create your account'}:</p>
            <div style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px 0;color:#111;">${otp}</div>
            <p style="color:#999;font-size:12px;text-align:center;">Expires in 10 minutes. Do not share this code.</p>
          </div>
        `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      status: 'success',
      message: 'OTP sent to email successfully',
      userExists,
    });
});

/**
 * POST /auth/verify-otp
 * Body: { email, otp, name? }   ← name is required for new users
 */
export const verifyOtp = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { email, otp, name } = req.body;

    if (!email || !otp) {
      throw new AppError('Please provide email and otp', 400);
    }

    const user = await User.findOne({ email });

    if (!user || !user.otp || !user.otpExpiry) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    if (user.otpExpiry < new Date()) {
      throw new AppError('OTP has expired', 400);
    }

    const isOtpCorrect = await bcrypt.compare(otp, user.otp);

    if (!isOtpCorrect) {
      throw new AppError('Invalid OTP', 400);
    }

    // If this is a new user (placeholder name), set the real name now
    if (user.name === '__pending__') {
      if (!name || !name.trim()) {
        throw new AppError('Please provide your name to complete registration', 400);
      }
      user.name = name.trim();
    }

    // Clear OTP details upon successful verification
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const token = generateTokenAndSetCookie(user._id.toString(), res);

    res.status(200).json({
      status: 'success',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        token,
      }
    });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
    res.cookie('jwt', '', { maxAge: 0 });
    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

export const getMe = catchAsync(async (req: Request | any, res: Response): Promise<void> => {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      throw new AppError('User not found', 404);
    }
    res.status(200).json({ status: 'success', data: user });
});
