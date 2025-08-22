const { generateExpenseReport, generateCSVReport } = require('../services/reportService');
const { getLeaderboard, getUserRank, getTopSpenders } = require('../services/leaderboardService');
const { User } = require('../models');

// Middleware to check if user is premium
const checkPremiumAccess = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const now = new Date();
        const isPremium = user.isPremium && user.premiumExpiryDate && new Date(user.premiumExpiryDate) > now;
        
        if (!isPremium) {
            return res.status(403).json({ 
                message: 'Premium membership required to access this feature',
                upgradeUrl: '/buy-premium'
            });
        }

        req.user.isPremium = true;
        next();
    } catch (error) {
        console.error('Error checking premium access:', error);
        res.status(500).json({ message: 'Failed to verify premium access' });
    }
};

// Generate expense report
const generateReport = async (req, res) => {
    try {
        const userId = req.user.id;
        const { type } = req.params; // daily, weekly, monthly
        const { format } = req.query; // json, csv

        // Validate report type
        const validTypes = ['daily', 'weekly', 'monthly'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ 
                message: 'Invalid report type. Use: daily, weekly, or monthly' 
            });
        }

        // Generate report data
        const reportData = await generateExpenseReport(userId, type);

        // Return CSV format if requested
        if (format === 'csv') {
            const csvData = generateCSVReport(reportData);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="expense-report-${type}-${Date.now()}.csv"`);
            return res.send(csvData);
        }

        // Return JSON format by default
        res.status(200).json({
            success: true,
            data: reportData
        });

    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to generate expense report',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get leaderboard
const getLeaderboardData = async (req, res) => {
    try {
        const { sort = 'DESC', limit = 50 } = req.query;
        
        const leaderboardData = await getLeaderboard(sort, limit);
        
        res.status(200).json({
            success: true,
            data: leaderboardData
        });

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch leaderboard',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get user's rank
const getUserRankData = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const rankData = await getUserRank(userId);
        
        res.status(200).json({
            success: true,
            data: rankData
        });

    } catch (error) {
        console.error('Error fetching user rank:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch user rank',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get top spenders for different periods
const getTopSpendersData = async (req, res) => {
    try {
        const { period = 'all', limit = 10 } = req.query;
        
        const topSpenders = await getTopSpenders(period, limit);
        
        res.status(200).json({
            success: true,
            data: {
                period: period,
                topSpenders: topSpenders,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error fetching top spenders:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch top spenders',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get premium features overview
const getPremiumFeatures = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get user's rank
        const userRank = await getUserRank(userId);
        
        // Get recent top spenders
        const topSpenders = await getTopSpenders('monthly', 5);
        
        res.status(200).json({
            success: true,
            data: {
                userRank: userRank,
                recentTopSpenders: topSpenders,
                availableReports: ['daily', 'weekly', 'monthly'],
                features: [
                    'Download expense reports (CSV/JSON)',
                    'View leaderboard rankings',
                    'Track your spending rank',
                    'Premium badge on leaderboard',
                    'Priority customer support'
                ]
            }
        });

    } catch (error) {
        console.error('Error fetching premium features:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch premium features',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    checkPremiumAccess,
    generateReport,
    getLeaderboardData,
    getUserRankData,
    getTopSpendersData,
    getPremiumFeatures
};
