const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
    return nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, userName) => {
    try {
        const transporter = createTransporter();
        
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: '🔐 Password Reset Request - Expense Tracker',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Password Reset</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #f4f6f8;
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 15px;
                            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .logo {
                            font-size: 2.5rem;
                            margin-bottom: 10px;
                        }
                        .title {
                            color: #2c3e50;
                            font-size: 1.8rem;
                            margin-bottom: 10px;
                        }
                        .subtitle {
                            color: #7f8c8d;
                            font-size: 1rem;
                        }
                        .content {
                            margin: 30px 0;
                        }
                        .greeting {
                            font-size: 1.1rem;
                            margin-bottom: 20px;
                        }
                        .message {
                            margin-bottom: 30px;
                            line-height: 1.8;
                        }
                        .reset-button {
                            display: inline-block;
                            background: linear-gradient(135deg, #667eea, #764ba2);
                            color: white;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 1rem;
                            margin: 20px 0;
                            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                        }
                        .reset-button:hover {
                            background: linear-gradient(135deg, #764ba2, #667eea);
                        }
                        .alternative-link {
                            background: #f8f9fa;
                            padding: 15px;
                            border-radius: 8px;
                            margin: 20px 0;
                            border-left: 4px solid #667eea;
                        }
                        .alternative-link p {
                            margin: 5px 0;
                            font-size: 0.9rem;
                        }
                        .alternative-link a {
                            color: #667eea;
                            word-break: break-all;
                        }
                        .footer {
                            margin-top: 40px;
                            padding-top: 20px;
                            border-top: 1px solid #e9ecef;
                            text-align: center;
                            color: #7f8c8d;
                            font-size: 0.9rem;
                        }
                        .warning {
                            background: #fff3cd;
                            border: 1px solid #ffeaa7;
                            color: #856404;
                            padding: 15px;
                            border-radius: 8px;
                            margin: 20px 0;
                        }
                        .security-tips {
                            background: #d4edda;
                            border: 1px solid #c3e6cb;
                            color: #155724;
                            padding: 15px;
                            border-radius: 8px;
                            margin: 20px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">💰</div>
                            <h1 class="title">Password Reset Request</h1>
                            <p class="subtitle">Expense Tracker</p>
                        </div>
                        
                        <div class="content">
                            <p class="greeting">Hello ${userName},</p>
                            
                            <div class="message">
                                <p>We received a request to reset your password for your Expense Tracker account. If you made this request, click the button below to reset your password:</p>
                            </div>
                            
                            <div style="text-align: center;">
                                <a href="${resetUrl}" class="reset-button">🔐 Reset My Password</a>
                            </div>
                            
                            <div class="alternative-link">
                                <p><strong>Button not working?</strong> Copy and paste this link into your browser:</p>
                                <p><a href="${resetUrl}">${resetUrl}</a></p>
                            </div>
                            
                            <div class="warning">
                                <p><strong>⚠️ Important:</strong> This password reset link will expire in 1 hour for security reasons.</p>
                            </div>
                            
                            <div class="security-tips">
                                <p><strong>🛡️ Security Tips:</strong></p>
                                <ul>
                                    <li>If you didn't request this password reset, please ignore this email</li>
                                    <li>Never share your password reset link with anyone</li>
                                    <li>Choose a strong, unique password for your account</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="footer">
                            <p>This email was sent from Expense Tracker</p>
                            <p>If you have any questions, please contact our support team</p>
                            <p style="margin-top: 15px; font-size: 0.8rem;">
                                This is an automated email. Please do not reply to this message.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('Failed to send password reset email');
    }
};

// Send password reset confirmation email
const sendPasswordResetConfirmation = async (email, userName) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: '✅ Password Successfully Reset - Expense Tracker',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Password Reset Confirmation</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #f4f6f8;
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 15px;
                            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .success-icon {
                            font-size: 3rem;
                            color: #27ae60;
                            margin-bottom: 15px;
                        }
                        .title {
                            color: #27ae60;
                            font-size: 1.8rem;
                            margin-bottom: 10px;
                        }
                        .subtitle {
                            color: #7f8c8d;
                            font-size: 1rem;
                        }
                        .content {
                            margin: 30px 0;
                        }
                        .login-button {
                            display: inline-block;
                            background: linear-gradient(135deg, #27ae60, #2ecc71);
                            color: white;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 1rem;
                            margin: 20px 0;
                            box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
                        }
                        .security-notice {
                            background: #fff3cd;
                            border: 1px solid #ffeaa7;
                            color: #856404;
                            padding: 15px;
                            border-radius: 8px;
                            margin: 20px 0;
                        }
                        .footer {
                            margin-top: 40px;
                            padding-top: 20px;
                            border-top: 1px solid #e9ecef;
                            text-align: center;
                            color: #7f8c8d;
                            font-size: 0.9rem;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="success-icon">✅</div>
                            <h1 class="title">Password Reset Successful</h1>
                            <p class="subtitle">Expense Tracker</p>
                        </div>
                        
                        <div class="content">
                            <p>Hello ${userName},</p>
                            
                            <p>Your password has been successfully reset. You can now log in to your Expense Tracker account with your new password.</p>
                            
                            <div style="text-align: center;">
                                <a href="${process.env.FRONTEND_URL}/login.html" class="login-button">🚪 Login to Your Account</a>
                            </div>
                            
                            <div class="security-notice">
                                <p><strong>🔒 Security Notice:</strong> If you did not reset your password, please contact our support team immediately.</p>
                            </div>
                        </div>
                        
                        <div class="footer">
                            <p>Thank you for using Expense Tracker</p>
                            <p>Stay secure and keep tracking your expenses!</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset confirmation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('Error sending confirmation email:', error);
        throw new Error('Failed to send confirmation email');
    }
};

module.exports = {
    sendPasswordResetEmail,
    sendPasswordResetConfirmation
};
