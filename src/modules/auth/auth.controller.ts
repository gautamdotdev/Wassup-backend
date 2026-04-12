import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../users/user.model.js';
import generateTokenAndSetCookie from '../../utils/generateToken.js';
import transporter from '../../utils/mailer.js';

export const requestOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Please provide an email' });
      return;
    }

    let user = await User.findOne({ email });

    if (!user) {
      // Create user if they don't exist
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
        from: '"Wassup App" <gautammakwana.dev@gmail.com>', // MUST be a verified sender in Brevo
        to: email, // list of receivers
        subject: "Your OTP for login/register", // Subject line
        text: `Your OTP is: ${otp}. It will expire in 10 minutes.`, // plain text body
        html: `<b>Your OTP is: ${otp}</b><br>It will expire in 10 minutes.`, // html body
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(info)

    res.status(200).json({ message: 'OTP sent to email successfully' });
  } catch (error: any) {
    console.error('Error in requestOtp controller', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ error: 'Please provide email and otp' });
      return;
    }

    const user = await User.findOne({ email });
    
    if (!user || !user.otp || !user.otpExpiry) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }

    if (user.otpExpiry < new Date()) {
      res.status(400).json({ error: 'OTP has expired' });
      return;
    }

    const isOtpCorrect = await bcrypt.compare(otp, user.otp);

    if (!isOtpCorrect) {
      res.status(400).json({ error: 'Invalid OTP' });
      return;
    }

    // Clear OTP details upon successful verification
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    generateTokenAndSetCookie(user._id.toString(), res);

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
    });
  } catch (error: any) {
    console.error('Error in verifyOtp controller', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const logout = (req: Request, res: Response) => {
  try {
    res.cookie('jwt', '', { maxAge: 0 });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Error in logout controller', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMe = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json(user);
  } catch (error: any) {
    console.error('Error in getMe controller', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
