const { User } = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendPasswordResetConfirmation } = require('../services/emailService');
const db = require('../models');
const { sequelize } = db;

// Request password reset
const requestPasswordReset = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { email } = req.body;
        
        if (!email) {
            await transaction.rollback();
            return res.status(400).json({ 
                success: false,
                message: 'Email is required' 
            });
        }

        // Find user by email
        const user = await User.findOne({ 
            where: { email: email.toLowerCase() },
            transaction 
        });

        // Always return success to prevent email enumeration attacks
        if (!user) {
            await transaction.rollback();
            return res.status(200).json({
                success: true,
                message: 'If an account with that email exists, we have sent a password reset link.'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        // Save reset token to user
        await user.update({
            resetPasswordToken: resetToken,
            resetPasswordExpires: resetTokenExpiry
        }, { transaction });

        // Send password reset email
        await sendPasswordResetEmail(
            user.email, 
            resetToken, 
            `${user.firstName} ${user.lastName}`
        );

        await transaction.commit();

        res.status(200).json({
            success: true,
            message: 'Password reset link has been sent to your email address.'
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error in requestPasswordReset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process password reset request. Please try again later.'
        });
    }
};

// Verify reset token
const verifyResetToken = async (req, res) => {
    try {
        const { token } = req.params;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Reset token is required'
            });
        }

        // Find user with valid reset token
        const user = await User.findOne({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: {
                    [sequelize.Sequelize.Op.gt]: new Date()
                }
            }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Reset token is valid',
            data: {
                email: user.email,
                name: `${user.firstName} ${user.lastName}`
            }
        });

    } catch (error) {
        console.error('Error in verifyResetToken:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify reset token'
        });
    }
};

// Reset password
const resetPassword = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { token, newPassword, confirmPassword } = req.body;
        
        // Validation
        if (!token || !newPassword || !confirmPassword) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Token, new password, and confirmation password are required'
            });
        }

        if (newPassword !== confirmPassword) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (newPassword.length < 7) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 7 characters long'
            });
        }

        // Find user with valid reset token
        const user = await User.findOne({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: {
                    [sequelize.Sequelize.Op.gt]: new Date()
                }
            },
            transaction
        });

        if (!user) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password and clear reset token
        await user.update({
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null
        }, { transaction });

        // Send confirmation email
        await sendPasswordResetConfirmation(
            user.email,
            `${user.firstName} ${user.lastName}`
        );

        await transaction.commit();

        res.status(200).json({
            success: true,
            message: 'Password has been reset successfully. You can now log in with your new password.'
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error in resetPassword:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password. Please try again.'
        });
    }
};

// Clean up expired reset tokens (maintenance function)
const cleanupExpiredTokens = async () => {
    const transaction = await sequelize.transaction();
    
    try {
        const result = await User.update({
            resetPasswordToken: null,
            resetPasswordExpires: null
        }, {
            where: {
                resetPasswordExpires: {
                    [sequelize.Sequelize.Op.lt]: new Date()
                }
            },
            transaction
        });

        await transaction.commit();
        
        console.log(`Cleaned up ${result[0]} expired password reset tokens`);
        return result[0];
        
    } catch (error) {
        await transaction.rollback();
        console.error('Error cleaning up expired tokens:', error);
        throw error;
    }
};

module.exports = {
    requestPasswordReset,
    verifyResetToken,
    resetPassword,
    cleanupExpiredTokens
};
