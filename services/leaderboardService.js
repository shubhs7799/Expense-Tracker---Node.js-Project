const { User, Expense } = require('../models');
const { sequelize } = require('../models');

const getLeaderboard = async (sortOrder = 'DESC', limit = 50) => {
    const transaction = await sequelize.transaction();
    
    try {
        // Validate sort order
        const validSortOrders = ['ASC', 'DESC'];
        if (!validSortOrders.includes(sortOrder.toUpperCase())) {
            sortOrder = 'DESC';
        }

        // Get users with their total expenses using raw SQL for better performance
        // Using transaction to ensure consistent read
        const leaderboardData = await sequelize.query(`
            SELECT 
                u.id,
                u."firstName",
                u."lastName",
                u."isPremium",
                COALESCE(SUM(e.amount), 0) as "totalExpenses",
                COUNT(e.id) as "expenseCount",
                MAX(e."createdAt") as "lastExpenseDate"
            FROM "Users" u
            LEFT JOIN "Expenses" e ON u.id = e."userId"
            GROUP BY u.id, u."firstName", u."lastName", u."isPremium"
            ORDER BY "totalExpenses" ${sortOrder.toUpperCase()}
            LIMIT :limit
        `, {
            replacements: { limit: parseInt(limit) },
            type: sequelize.QueryTypes.SELECT,
            transaction: transaction
        });

        // Format the data
        const formattedLeaderboard = leaderboardData.map((user, index) => ({
            rank: index + 1,
            userId: user.id,
            name: `${user.firstName} ${user.lastName}`,
            isPremium: user.isPremium,
            totalExpenses: parseFloat(user.totalExpenses).toFixed(2),
            expenseCount: parseInt(user.expenseCount),
            lastExpenseDate: user.lastExpenseDate ? new Date(user.lastExpenseDate).toISOString().split('T')[0] : null,
            badge: getBadge(parseFloat(user.totalExpenses), user.isPremium)
        }));

        await transaction.commit();

        return {
            leaderboard: formattedLeaderboard,
            metadata: {
                totalUsers: formattedLeaderboard.length,
                sortOrder: sortOrder.toUpperCase(),
                generatedAt: new Date().toISOString(),
                topSpender: formattedLeaderboard.length > 0 ? formattedLeaderboard[0] : null,
                averageExpense: calculateAverageExpense(formattedLeaderboard)
            }
        };
    } catch (error) {
        await transaction.rollback();
        console.error('Error generating leaderboard:', error);
        throw error;
    }
};

const getUserRank = async (userId) => {
    const transaction = await sequelize.transaction();
    
    try {
        // Get user's total expenses within transaction
        const userExpenses = await Expense.sum('amount', {
            where: { userId: userId },
            transaction: transaction
        }) || 0;

        // Count how many users have higher total expenses
        const higherRankCount = await sequelize.query(`
            SELECT COUNT(*) as count
            FROM (
                SELECT u.id, COALESCE(SUM(e.amount), 0) as total
                FROM "Users" u
                LEFT JOIN "Expenses" e ON u.id = e."userId"
                GROUP BY u.id
                HAVING COALESCE(SUM(e.amount), 0) > :userExpenses
            ) as higher_users
        `, {
            replacements: { userExpenses: userExpenses },
            type: sequelize.QueryTypes.SELECT,
            transaction: transaction
        });

        const rank = parseInt(higherRankCount[0].count) + 1;

        // Get total number of users
        const totalUsers = await User.count({ transaction: transaction });

        await transaction.commit();

        return {
            userId: userId,
            rank: rank,
            totalExpenses: parseFloat(userExpenses).toFixed(2),
            totalUsers: totalUsers,
            percentile: ((totalUsers - rank + 1) / totalUsers * 100).toFixed(1)
        };
    } catch (error) {
        await transaction.rollback();
        console.error('Error getting user rank:', error);
        throw error;
    }
};

const getTopSpenders = async (period = 'all', limit = 10) => {
    const transaction = await sequelize.transaction();
    
    try {
        let dateFilter = {};
        const now = new Date();

        switch (period) {
            case 'daily':
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                dateFilter = {
                    createdAt: {
                        [sequelize.Sequelize.Op.gte]: today
                    }
                };
                break;
            case 'weekly':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                dateFilter = {
                    createdAt: {
                        [sequelize.Sequelize.Op.gte]: weekStart
                    }
                };
                break;
            case 'monthly':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                dateFilter = {
                    createdAt: {
                        [sequelize.Sequelize.Op.gte]: monthStart
                    }
                };
                break;
            case 'all':
            default:
                // No date filter for all time
                break;
        }

        const topSpenders = await User.findAll({
            attributes: [
                'id',
                'firstName',
                'lastName',
                'isPremium',
                [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('Expenses.amount')), 0), 'totalExpenses'],
                [sequelize.fn('COUNT', sequelize.col('Expenses.id')), 'expenseCount']
            ],
            include: [{
                model: Expense,
                attributes: [],
                where: dateFilter,
                required: false
            }],
            group: ['User.id'],
            order: [[sequelize.literal('totalExpenses'), 'DESC']],
            limit: parseInt(limit),
            raw: true,
            transaction: transaction
        });

        await transaction.commit();

        return topSpenders.map((user, index) => ({
            rank: index + 1,
            userId: user.id,
            name: `${user.firstName} ${user.lastName}`,
            isPremium: user.isPremium,
            totalExpenses: parseFloat(user.totalExpenses).toFixed(2),
            expenseCount: parseInt(user.expenseCount),
            badge: getBadge(parseFloat(user.totalExpenses), user.isPremium),
            period: period
        }));
    } catch (error) {
        await transaction.rollback();
        console.error('Error getting top spenders:', error);
        throw error;
    }
};

// Atomic operation to update leaderboard when expense is added/updated/deleted
const updateLeaderboardCache = async (userId, expenseChange = 0) => {
    const transaction = await sequelize.transaction();
    
    try {
        // This could be used to maintain a cached leaderboard table if needed
        // For now, we'll just ensure the calculation is consistent
        
        // Recalculate user's total expenses
        const userTotalExpenses = await Expense.sum('amount', {
            where: { userId: userId },
            transaction: transaction
        }) || 0;

        // Log the change for audit purposes
        console.log(`User ${userId} total expenses updated: ₹${userTotalExpenses.toFixed(2)}`);

        await transaction.commit();
        
        return {
            userId: userId,
            newTotal: parseFloat(userTotalExpenses).toFixed(2),
            change: expenseChange
        };
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating leaderboard cache:', error);
        throw error;
    }
};

// Batch operation to recalculate all user totals (for maintenance)
const recalculateAllUserTotals = async () => {
    const transaction = await sequelize.transaction();
    
    try {
        console.log('Starting leaderboard recalculation...');
        
        // Get all users with their actual expense totals
        const userTotals = await sequelize.query(`
            SELECT 
                u.id,
                u."firstName",
                u."lastName",
                COALESCE(SUM(e.amount), 0) as "actualTotal",
                COUNT(e.id) as "expenseCount"
            FROM "Users" u
            LEFT JOIN "Expenses" e ON u.id = e."userId"
            GROUP BY u.id, u."firstName", u."lastName"
            ORDER BY "actualTotal" DESC
        `, {
            type: sequelize.QueryTypes.SELECT,
            transaction: transaction
        });

        console.log(`Recalculated totals for ${userTotals.length} users`);
        
        // Log top 5 users for verification
        userTotals.slice(0, 5).forEach((user, index) => {
            console.log(`#${index + 1}: ${user.firstName} ${user.lastName} - ₹${parseFloat(user.actualTotal).toFixed(2)} (${user.expenseCount} expenses)`);
        });

        await transaction.commit();
        
        return {
            totalUsers: userTotals.length,
            recalculatedAt: new Date().toISOString(),
            topUsers: userTotals.slice(0, 10)
        };
    } catch (error) {
        await transaction.rollback();
        console.error('Error recalculating user totals:', error);
        throw error;
    }
};

// Helper function to assign badges based on spending
const getBadge = (totalExpenses, isPremium) => {
    if (isPremium) {
        if (totalExpenses >= 100000) return '👑 Premium Platinum';
        if (totalExpenses >= 50000) return '💎 Premium Gold';
        if (totalExpenses >= 25000) return '⭐ Premium Silver';
        return '🌟 Premium Member';
    } else {
        if (totalExpenses >= 100000) return '🏆 Big Spender';
        if (totalExpenses >= 50000) return '🥇 High Roller';
        if (totalExpenses >= 25000) return '🥈 Active User';
        if (totalExpenses >= 10000) return '🥉 Regular User';
        return '🌱 New User';
    }
};

// Helper function to calculate average expense
const calculateAverageExpense = (leaderboard) => {
    if (leaderboard.length === 0) return '0.00';
    
    const total = leaderboard.reduce((sum, user) => sum + parseFloat(user.totalExpenses), 0);
    return (total / leaderboard.length).toFixed(2);
};

module.exports = {
    getLeaderboard,
    getUserRank,
    getTopSpenders,
    updateLeaderboardCache,
    recalculateAllUserTotals
};
