const axios = require('axios');
const { appId, secretKey, baseUrl } = require('../config/cashfree-config.js');
const db = require('../models/index.js');
const Payment = db.Payment;
const User = db.User;
const { sequelize } = db; // Import sequelize instance for transactions

const createOrder = async (
    order_amount,
    order_currency = 'INR',
    order_id,
    customer_id,
    customer_phone,
    userId
) => {
    // Start a database transaction
    const transaction = await sequelize.transaction();
    
    try {
        const expiryDate = new Date(Date.now() + 60 * 60 * 1000);
        const formattedExpiryDate = expiryDate.toISOString();
        
        const orderRequest = {
            order_amount: order_amount,
            order_currency: order_currency,
            order_id: order_id,
            customer_details: {
                customer_id: customer_id,
                customer_phone: customer_phone
            },
            order_meta: {
                return_url: `http://localhost:3000/api/v1/payment/status/${order_id}`,
                payment_methods: "cc,dc,upi"
            },
            order_expiry_time: formattedExpiryDate
        };

        // Call Cashfree API
        const response = await axios.post(`${baseUrl}/orders`, orderRequest, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-version': '2023-08-01',
                'x-client-id': appId,
                'x-client-secret': secretKey
            }
        });

        // Save payment record in database within transaction
        await Payment.create({
            orderId: order_id,
            userId: userId,
            amount: order_amount,
            status: 'PENDING',
            paymentSessionId: response.data.payment_session_id
        }, { transaction });

        // Commit the transaction
        await transaction.commit();
        
        console.log(`Payment order created successfully: ${order_id}`);
        return response.data.payment_session_id;
        
    } catch (error) {
        // Rollback the transaction on error
        await transaction.rollback();
        console.log('Error creating order:', error.response?.data || error.message);
        throw error;
    }
};

const fetchPaymentStatus = async (orderId) => {
    // Start a database transaction
    const transaction = await sequelize.transaction();
    
    try {
        console.log(`Fetching payment status for order: ${orderId}`);
        
        // Get payment record first
        const payment = await Payment.findOne({ 
            where: { orderId: orderId },
            transaction 
        });
        
        if (!payment) {
            await transaction.rollback();
            throw new Error('Payment record not found');
        }

        // If payment is already successful, don't check again
        if (payment.status === 'SUCCESS') {
            await transaction.commit();
            return 'SUCCESS';
        }

        // Call Cashfree API to get payment status
        const response = await axios.get(`${baseUrl}/orders/${orderId}/payments`, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-version': '2023-08-01',
                'x-client-id': appId,
                'x-client-secret': secretKey
            }
        });

        let orderStatus;
        const payments = response.data;

        if (payments && payments.length > 0) {
            const successfulPayments = payments.filter(transaction => transaction.payment_status === "SUCCESS");
            const pendingPayments = payments.filter(transaction => transaction.payment_status === "PENDING");
            
            if (successfulPayments.length > 0) {
                orderStatus = "SUCCESS"
            } else if (pendingPayments.length > 0) {
                orderStatus = "PENDING"
            } else {
                orderStatus = "FAILED"
            }
        } else {
            orderStatus = "FAILED";
        }

        console.log(`Payment status for ${orderId}: ${orderStatus}`);

        // Update payment status within transaction
        await payment.update({ status: orderStatus }, { transaction });
        
        // If payment successful, update user premium status
        if (orderStatus === "SUCCESS") {
            const user = await User.findByPk(payment.userId, { transaction });
            
            if (!user) {
                throw new Error('User not found');
            }

            // Check if user is already premium to avoid duplicate updates
            const now = new Date();
            const isAlreadyPremium = user.isPremium && user.premiumExpiryDate && new Date(user.premiumExpiryDate) > now;
            
            if (!isAlreadyPremium) {
                const premiumExpiryDate = new Date();
                premiumExpiryDate.setFullYear(premiumExpiryDate.getFullYear() + 1); // 1 year premium
                
                await user.update({
                    isPremium: true,
                    premiumExpiryDate: premiumExpiryDate
                }, { transaction });
                
                console.log(`User ${user.id} upgraded to premium until ${premiumExpiryDate}`);
            } else {
                console.log(`User ${user.id} is already premium`);
            }
        }

        // Commit all changes
        await transaction.commit();
        return orderStatus;
        
    } catch (error) {
        // Rollback the transaction on error
        await transaction.rollback();
        console.log('Error fetching payment status:', error.response?.data || error.message);
        throw error;
    }
}

// Helper function to check and update expired premium memberships
const checkExpiredPremiumMemberships = async () => {
    const transaction = await sequelize.transaction();
    
    try {
        const now = new Date();
        
        // Find users with expired premium memberships
        const expiredUsers = await User.findAll({
            where: {
                isPremium: true,
                premiumExpiryDate: {
                    [db.Sequelize.Op.lt]: now
                }
            },
            transaction
        });

        // Update expired users
        for (const user of expiredUsers) {
            await user.update({
                isPremium: false,
                premiumExpiryDate: null
            }, { transaction });
            
            console.log(`User ${user.id} premium membership expired`);
        }

        await transaction.commit();
        console.log(`Processed ${expiredUsers.length} expired premium memberships`);
        
    } catch (error) {
        await transaction.rollback();
        console.log('Error checking expired memberships:', error.message);
        throw error;
    }
};

module.exports = {
    createOrder,
    fetchPaymentStatus,
    checkExpiredPremiumMemberships
}

