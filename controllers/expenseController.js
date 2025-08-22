const { Expense } = require('../models');
const { Op } = require('sequelize');
const { updateLeaderboardCache } = require('../services/leaderboardService');
const db = require('../models');
const { sequelize } = db;

const getUserExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get pagination parameters from query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`Server received pagination params: page=${req.query.page}, limit=${req.query.limit}`);
    console.log(`Parsed values: page=${page}, limit=${limit}`);
    
    // Validate pagination parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page
    const offset = (validatedPage - 1) * validatedLimit;
    
    console.log(`Final values: validatedPage=${validatedPage}, validatedLimit=${validatedLimit}, offset=${offset}`);
    
    // Build where conditions
    const whereConditions = {
      [Op.or]: [
        { userId },
        { splitWith: { [Op.contains]: [userId] } },
      ],
    };

    // Get total count for pagination info
    const totalCount = await Expense.count({
      where: whereConditions,
    });
    
    // Get paginated expenses
    const expenses = await Expense.findAll({
      where: whereConditions,
      order: [['createdAt', 'DESC']], // Always sort by newest first
      limit: validatedLimit,
      offset: offset,
      attributes: ['id', 'amount', 'description', 'categories', 'splitWith', 'createdAt', 'updatedAt']
    });
    
    console.log(`Database returned ${expenses.length} expenses out of ${totalCount} total`);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasNextPage = validatedPage < totalPages;
    const hasPrevPage = validatedPage > 1;
    
    res.status(200).json({ 
      expenses,
      pagination: {
        currentPage: validatedPage,
        totalPages,
        totalCount,
        limit: validatedLimit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? validatedPage + 1 : null,
        prevPage: hasPrevPage ? validatedPage - 1 : null
      }
    });
  } catch (err) {
    console.error('Error in getUserExpenses:', err);
    res.status(500).json({ 
      message: err.message 
    });
  }
};

const createExpense = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { amount, description, categories, splitWith } = req.body;
    const userId = req.user.id;

    // Create expense within transaction
    const expense = await Expense.create({
      amount,
      description,
      categories,
      splitWith: splitWith || [],
      userId,
    }, { transaction });

    // Update leaderboard cache for the user
    await updateLeaderboardCache(userId, parseFloat(amount));

    await transaction.commit();

    res.status(201).json({ expense });
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating expense:', err);
    res.status(400).json({ message: err.message });
  }
};

// Update expense (only by owner)
const updateExpense = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const expenseId = req.params.id;
    const userId = req.user.id;

    const expense = await Expense.findOne({ 
      where: { id: expenseId, userId },
      transaction 
    });

    if (!expense) {
      await transaction.rollback();
      return res.status(404).json({ message: "Expense not found or not authorized" });
    }

    const { amount, description, categories, splitWith = [] } = req.body;
    
    // Calculate the difference for leaderboard update
    const oldAmount = parseFloat(expense.amount);
    const newAmount = parseFloat(amount);
    const amountDifference = newAmount - oldAmount;

    // Update expense within transaction
    await expense.update({ 
      amount, 
      description, 
      categories, 
      splitWith 
    }, { transaction });

    // Update leaderboard cache if amount changed
    if (amountDifference !== 0) {
      await updateLeaderboardCache(userId, amountDifference);
    }

    await transaction.commit();

    res.status(200).json({ message: "Expense updated", expense });
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating expense:', err);
    res.status(500).json({ message: err.message });
  }
};

// Delete expense (only by owner)
const deleteExpense = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const expenseId = req.params.id;
    const userId = req.user.id;

    const expense = await Expense.findOne({ 
      where: { id: expenseId, userId },
      transaction 
    });

    if (!expense) {
      await transaction.rollback();
      return res.status(404).json({ message: "Expense not found or not authorized" });
    }

    const deletedAmount = parseFloat(expense.amount);

    // Delete expense within transaction
    await expense.destroy({ transaction });

    // Update leaderboard cache (subtract the deleted amount)
    await updateLeaderboardCache(userId, -deletedAmount);

    await transaction.commit();

    res.status(200).json({ message: "Expense deleted successfully" });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting expense:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { 
  getUserExpenses, 
  createExpense, 
  updateExpense, 
  deleteExpense
};
