import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../users/user.model.js';
import generateTokenAndSetCookie from '../../utils/generateToken.js';
import transporter from '../../utils/mailer.js';
import { catchAsync, AppError } from '../../utils/errors.js';
import config from '../../config/env.config.js';

export const requestOtp = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { email, name } = req.body;

    if (!email) {
      throw new AppError('Please provide an email', 400);
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name: name || email.split('@')[0], 
        email,
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash OTP
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    user.otp = hashedOtp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry
    await user.save();

    // Send Email
    const mailOptions = {
        from: config.smtp.from,
        to: email,
        subject: "Your OTP for login/register",
        text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
        html: `<b>Your OTP is: ${otp}</b><br>It will expire in 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ status: 'success', message: 'OTP sent to email successfully' });
});

export const verifyOtp = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { email, otp } = req.body;

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

