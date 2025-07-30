const express = require('express');
const { signup, login } = require('../controllers/authController');
const { createExpense, getUserExpenses, updateExpense, deleteExpense } = require('../controllers/expenseController');
const { buyPremium, getPaymentStatus, checkPremiumStatus, updatePaymentStatus } = require('../controllers/paymentController');
const { 
    checkPremiumAccess, 
    generateReport, 
    getLeaderboardData, 
    getUserRankData, 
    getTopSpendersData, 
    getPremiumFeatures 
} = require('../controllers/premiumController');
const { 
    requestPasswordReset, 
    verifyResetToken, 
    resetPassword, 
    cleanupExpiredTokens 
} = require('../controllers/passwordResetController');
const { recalculateAllUserTotals } = require('../services/leaderboardService');
const authenticate = require('../middleware/auth');

const router = express.Router();

// Auth
router.post('/signup', signup);
router.post('/login', login);

// Password Reset
router.post('/forgot-password', requestPasswordReset);
router.get('/verify-reset-token/:token', verifyResetToken);
router.post('/reset-password', resetPassword);

// Expenses
router.post('/expenses', authenticate, createExpense);
router.get('/expenses', authenticate, getUserExpenses);
router.put("/expenses/:id", authenticate, updateExpense);
router.delete("/expenses/:id", authenticate, deleteExpense);

// Premium/Payment
router.post('/buy-premium', authenticate, buyPremium);
router.get('/payment/status/:orderId', getPaymentStatus);
router.get('/premium-status', authenticate, checkPremiumStatus);

// Premium Features (require premium membership)
router.get('/premium/features', authenticate, checkPremiumAccess, getPremiumFeatures);
router.get('/premium/reports/:type', authenticate, checkPremiumAccess, generateReport);
router.get('/premium/leaderboard', authenticate, checkPremiumAccess, getLeaderboardData);
router.get('/premium/my-rank', authenticate, checkPremiumAccess, getUserRankData);
router.get('/premium/top-spenders', authenticate, checkPremiumAccess, getTopSpendersData);

// Admin routes (for testing/debugging)
router.post('/admin/update-payment-status', authenticate, updatePaymentStatus);
router.post('/admin/recalculate-leaderboard', authenticate, async (req, res) => {
    try {
        console.log('Admin leaderboard recalculation requested by user:', req.user.id);
        const result = await recalculateAllUserTotals();
        res.status(200).json({
            success: true,
            message: 'Leaderboard recalculated successfully',
            data: result
        });
    } catch (error) {
        console.error('Error in admin leaderboard recalculation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to recalculate leaderboard',
            error: error.message
        });
    }
});
router.post('/admin/cleanup-expired-tokens', authenticate, async (req, res) => {
    try {
        const cleanedCount = await cleanupExpiredTokens();
        res.status(200).json({
            success: true,
            message: `Cleaned up ${cleanedCount} expired password reset tokens`
        });
    } catch (error) {
        console.error('Error cleaning up expired tokens:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup expired tokens',
            error: error.message
        });
    }
});

module.exports = router;
