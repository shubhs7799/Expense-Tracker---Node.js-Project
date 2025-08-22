const { Expense, User } = require('../models');
const { Op } = require('sequelize');

const generateExpenseReport = async (userId, reportType) => {
    try {
        let startDate, endDate;
        const now = new Date();
        
        // Calculate date ranges based on report type
        switch (reportType) {
            case 'daily':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                break;
            case 'weekly':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
                weekStart.setHours(0, 0, 0, 0);
                startDate = weekStart;
                endDate = new Date(weekStart);
                endDate.setDate(weekStart.getDate() + 7);
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                break;
            default:
                throw new Error('Invalid report type');
        }

        // Get user details
        const user = await User.findByPk(userId, {
            attributes: ['firstName', 'lastName', 'email']
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Get expenses for the date range
        const expenses = await Expense.findAll({
            where: {
                userId: userId,
                createdAt: {
                    [Op.gte]: startDate,
                    [Op.lt]: endDate
                }
            },
            order: [['createdAt', 'DESC']],
            attributes: ['amount', 'description', 'categories', 'createdAt']
        });

        // Calculate totals by category
        const categoryTotals = {};
        let totalAmount = 0;

        expenses.forEach(expense => {
            totalAmount += parseFloat(expense.amount);
            const category = expense.categories;
            if (categoryTotals[category]) {
                categoryTotals[category] += parseFloat(expense.amount);
            } else {
                categoryTotals[category] = parseFloat(expense.amount);
            }
        });

        // Generate report data
        const reportData = {
            reportType: reportType.toUpperCase(),
            generatedAt: now.toISOString(),
            dateRange: {
                from: startDate.toISOString().split('T')[0],
                to: new Date(endDate.getTime() - 1).toISOString().split('T')[0]
            },
            user: {
                name: `${user.firstName} ${user.lastName}`,
                email: user.email
            },
            summary: {
                totalExpenses: expenses.length,
                totalAmount: totalAmount.toFixed(2),
                averageExpense: expenses.length > 0 ? (totalAmount / expenses.length).toFixed(2) : '0.00'
            },
            categoryBreakdown: Object.entries(categoryTotals).map(([category, amount]) => ({
                category,
                amount: amount.toFixed(2),
                percentage: ((amount / totalAmount) * 100).toFixed(1)
            })).sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)),
            expenses: expenses.map(expense => ({
                date: expense.createdAt.toISOString().split('T')[0],
                amount: parseFloat(expense.amount).toFixed(2),
                description: expense.description,
                category: expense.categories
            }))
        };

        return reportData;
    } catch (error) {
        console.error('Error generating expense report:', error);
        throw error;
    }
};

const generateCSVReport = (reportData) => {
    try {
        let csv = '';
        
        // Header information
        csv += `Expense Report - ${reportData.reportType}\n`;
        csv += `Generated: ${new Date(reportData.generatedAt).toLocaleString()}\n`;
        csv += `User: ${reportData.user.name} (${reportData.user.email})\n`;
        csv += `Period: ${reportData.dateRange.from} to ${reportData.dateRange.to}\n\n`;
        
        // Summary
        csv += `SUMMARY\n`;
        csv += `Total Expenses,${reportData.summary.totalExpenses}\n`;
        csv += `Total Amount,₹${reportData.summary.totalAmount}\n`;
        csv += `Average Expense,₹${reportData.summary.averageExpense}\n\n`;
        
        // Category breakdown
        csv += `CATEGORY BREAKDOWN\n`;
        csv += `Category,Amount,Percentage\n`;
        reportData.categoryBreakdown.forEach(cat => {
            csv += `${cat.category},₹${cat.amount},${cat.percentage}%\n`;
        });
        csv += `\n`;
        
        // Detailed expenses
        csv += `DETAILED EXPENSES\n`;
        csv += `Date,Amount,Description,Category\n`;
        reportData.expenses.forEach(expense => {
            csv += `${expense.date},₹${expense.amount},"${expense.description}",${expense.category}\n`;
        });
        
        return csv;
    } catch (error) {
        console.error('Error generating CSV report:', error);
        throw error;
    }
};

module.exports = {
    generateExpenseReport,
    generateCSVReport
};
