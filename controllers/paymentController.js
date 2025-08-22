const { createOrder, fetchPaymentStatus, checkExpiredPremiumMemberships } = require('../services/paymentService');
const { User } = require('../models');
const db = require('../models');
const { sequelize } = db;

const buyPremium = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const userId = req.user.id;
        
        // Get user within transaction to ensure data consistency
        const user = await User.findByPk(userId, { transaction });
        
        if (!user) {
            await transaction.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user is already premium
        const now = new Date();
        if (user.isPremium && user.premiumExpiryDate && new Date(user.premiumExpiryDate) > now) {
            await transaction.rollback();
            return res.status(400).json({ 
                message: 'You are already a premium member',
                expiryDate: user.premiumExpiryDate
            });
        }

        // Check for existing pending payment
        const existingPayment = await db.Payment.findOne({
            where: {
                userId: userId,
                status: 'PENDING'
            },
            transaction
        });

        if (existingPayment) {
            await transaction.rollback();
            return res.status(400).json({ 
                message: 'You already have a pending payment. Please complete or cancel it first.',
                orderId: existingPayment.orderId
            });
        }

        await transaction.commit();

        // Generate unique order ID
        const orderId = `order_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const amount = 499; // Premium membership price in INR
        const customerId = `customer_${userId}`;
        const customerPhone = user.phone || "9999999999"; // Use user's phone or default

        // Create order (this will handle its own transaction)
        const paymentSessionId = await createOrder(
            amount,
            'INR',
            orderId,
            customerId,
            customerPhone,
            userId
        );

        res.status(200).json({
            success: true,
            paymentSessionId,
            orderId,
            amount,
            message: 'Payment order created successfully'
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error in buyPremium:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create payment order',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getPaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        if (!orderId) {
            return res.redirect('/dashboard.html?payment=error&message=Invalid order ID');
        }

        console.log(`Processing payment status for order: ${orderId}`);
        
        // Fetch payment status (this will handle its own transaction)
        const status = await fetchPaymentStatus(orderId);
        
        // Redirect based on status
        switch (status) {
            case 'SUCCESS':
                res.redirect('/dashboard.html?payment=success');
                break;
            case 'FAILED':
                res.redirect('/dashboard.html?payment=failed');
                break;
            case 'PENDING':
                res.redirect('/dashboard.html?payment=pending');
                break;
            default:
                res.redirect('/dashboard.html?payment=error');
        }
        
    } catch (error) {
        console.error('Error fetching payment status:', error);
        res.redirect('/dashboard.html?payment=error&message=Status check failed');
    }
};

const checkPremiumStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // First, check and update any expired memberships
        await checkExpiredPremiumMemberships();
        
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const now = new Date();
        const isPremium = user.isPremium && user.premiumExpiryDate && new Date(user.premiumExpiryDate) > now;
        
        res.status(200).json({
            isPremium,
            premiumExpiryDate: user.premiumExpiryDate,
            daysRemaining: isPremium ? Math.ceil((new Date(user.premiumExpiryDate) - now) / (1000 * 60 * 60 * 24)) : 0
        });
        
    } catch (error) {
        console.error('Error checking premium status:', error);
        res.status(500).json({ 
            message: 'Failed to check premium status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Admin function to manually update payment status (for testing)
const updatePaymentStatus = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { orderId, status } = req.body;
        
        if (!orderId || !status) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Order ID and status are required' });
        }

        const payment = await db.Payment.findOne({ 
            where: { orderId },
            transaction 
        });
        
        if (!payment) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Payment not found' });
        }

        await payment.update({ status }, { transaction });
        
        // If marking as successful, update user premium status
        if (status === 'SUCCESS') {
            const user = await User.findByPk(payment.userId, { transaction });
            if (user) {
                const premiumExpiryDate = new Date();
                premiumExpiryDate.setFullYear(premiumExpiryDate.getFullYear() + 1);
                
                await user.update({
                    isPremium: true,
                    premiumExpiryDate: premiumExpiryDate
                }, { transaction });
            }
        }

        await transaction.commit();
        
        res.status(200).json({
            message: 'Payment status updated successfully',
            payment: {
                orderId: payment.orderId,
                status: payment.status,
                amount: payment.amount
            }
        });
        
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating payment status:', error);
        res.status(500).json({ 
            message: 'Failed to update payment status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    buyPremium,
    getPaymentStatus,
    checkPremiumStatus,
    updatePaymentStatus
};
