// public/app.js

const baseURL = '/api/v1';
const token = localStorage.getItem('token');

// Pagination state
let currentPage = 1;
let itemsPerPage = 5;
let totalPages = 1;
let totalCount = 0;

// Filter state
let currentFilters = {
  search: '',
  category: '',
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

// Utility functions
function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  } else {
    // If no specific error element, show alert
    console.error('Error:', message);
    alert('Error: ' + message);
  }
}

// ======================= SIGNUP =======================
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
      submitBtn.innerHTML = '<div class="loading"></div> Creating Account...';
      submitBtn.disabled = true;

      const res = await fetch(`${baseURL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      localStorage.setItem('token', data.token);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError('signupError', err.message);
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ======================= LOGIN =======================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
      submitBtn.innerHTML = '<div class="loading"></div> Signing In...';
      submitBtn.disabled = true;

      const res = await fetch(`${baseURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      localStorage.setItem('token', data.token);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError('loginError', err.message);
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ======================= DASHBOARD =======================
const expenseForm = document.getElementById('expenseForm');
const expenseTableBody = document.querySelector('#expenseTable tbody');
const logoutBtn = document.getElementById('logoutBtn');
const buyMembershipBtn = document.getElementById('buy-membership');
const premiumBanner = document.getElementById('premium-banner');
const membershipSection = document.getElementById('membership-section');
const noExpensesDiv = document.getElementById('no-expenses');
const premiumFeaturesDiv = document.getElementById('premium-features');
const expensesLoadingDiv = document.getElementById('expenses-loading');

const amountInput = document.getElementById('amount');
const descriptionInput = document.getElementById('description');
const categoryInput = document.getElementById('category');
const splitWithInput = document.getElementById('splitWith');
const formBtnText = document.getElementById('form-btn-text');

// Items per page selector
let itemsPerPageSelect = document.getElementById('items-per-page');

let editMode = false;
let editingId = null;
let userIsPremium = false;

if (expenseForm && token) {
  console.log('Dashboard initialization started');
  console.log('Elements found:', {
    expenseForm: !!expenseForm,
    expenseTableBody: !!expenseTableBody,
    itemsPerPageSelect: !!itemsPerPageSelect,
    token: !!token
  });
  
  loadExpenses();
  checkPremiumStatus();
  checkPaymentStatus();
  initializePremiumFeatures();
  initializePagination();

  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const expenseData = {
      amount: parseFloat(amountInput.value),
      description: descriptionInput.value,
      categories: categoryInput.value,
      // splitWith: splitWithInput.value ? splitWithInput.value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [],
    };

    const url = editMode ? `${baseURL}/expenses/${editingId}` : `${baseURL}/expenses`;
    const method = editMode ? 'PUT' : 'POST';
    
    const submitBtn = expenseForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
      submitBtn.innerHTML = '<div class="loading"></div> Saving...';
      submitBtn.disabled = true;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(expenseData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save expense');

      expenseForm.reset();
      editMode = false;
      editingId = null;
      if (formBtnText) formBtnText.textContent = 'Add Expense';
      
      // Reload expenses to reflect changes
      loadExpenses();
      
      // Refresh leaderboard data if user is premium
      if (userIsPremium) {
        loadUserRank();
      }
      
      showSuccessMessage(editMode ? 'Expense updated successfully!' : 'Expense added successfully!');
      
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ======================= PAGINATION =======================

async function loadExpenses() {
  console.log(`Loading page ${currentPage} with limit ${itemsPerPage}`);
  
  // Fetch data from backend
  const res = await fetch(`${baseURL}/expenses?page=${currentPage}&limit=${itemsPerPage}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  const { expenses, pagination } = data;

  // Update global state
  currentPage = pagination.currentPage;
  totalPages = pagination.totalPages;
  totalCount = pagination.totalCount;

  // Clear table
  expenseTableBody.innerHTML = '';

  // If no expenses
  if (expenses.length === 0) {
    expenseTableBody.innerHTML = `<tr><td colspan="5">No expenses found</td></tr>`;
    updatePaginationUI();
    return;
  }

  // Render expenses
  expenses.forEach((exp) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>₹${exp.amount}</td>
      <td>${exp.description}</td>
      <td>${exp.categories}</td>
      <td>${new Date(exp.createdAt).toLocaleDateString()}</td>
    `;
    expenseTableBody.appendChild(row);
  });

  updatePaginationUI();
}

function updatePaginationUI() {
  // Info text
  const start = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalCount);
  document.getElementById('pagination-info').textContent =
    `Showing ${start}-${end} of ${totalCount}`;

  // Buttons
  const btns = document.getElementById('pagination-buttons');
  btns.innerHTML = '';

  if (currentPage > 1) {
    const prev = document.createElement('button');
    prev.textContent = '← Previous';
    prev.onclick = () => { currentPage--; loadExpenses(); };
    btns.appendChild(prev);
  }

  if (currentPage < totalPages) {
    const next = document.createElement('button');
    next.textContent = 'Next →';
    next.onclick = () => { currentPage++; loadExpenses(); };
    btns.appendChild(next);
  }
}

// Items per page dropdown
function initializePagination() {
  const select = document.getElementById('items-per-page');
  if (!select) return;
  
  select.addEventListener('change', (e) => {
    itemsPerPage = parseInt(e.target.value);
    currentPage = 1;
    loadExpenses();
  });
}

// Call this when page loads
initializePagination();
loadExpenses();

//======================================================//
function getCategoryEmoji(category) {
  const emojis = {
    fashion: '👗',
    food: '🍕',
    fuel: '⛽',
    entertainment: '🎬',
    healthcare: '🏥',
    education: '📚',
    other: '📦'
  };
  return emojis[category] || '📦';
}

window.editExpense = function (id, amount, description, categories, splitWith) {
  if (amountInput) amountInput.value = amount;
  if (descriptionInput) descriptionInput.value = description;
  if (categoryInput) categoryInput.value = categories;
  if (splitWithInput) splitWithInput.value = splitWith.replace(/[\[\]\s]/g, '');

  editMode = true;
  editingId = id;
  if (formBtnText) formBtnText.textContent = 'Update Expense';
  
  // Scroll to form and highlight it
  if (expenseForm) {
    expenseForm.scrollIntoView({ behavior: 'smooth' });
    expenseForm.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.3)';
    setTimeout(() => {
      expenseForm.style.boxShadow = '';
    }, 2000);
  }
};

window.deleteExpense = async function (id) {
  if (!confirm('Are you sure you want to delete this expense?')) return;
  
  try {
    const res = await fetch(`${baseURL}/expenses/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete');
    
    // Reload current page, but go to previous page if current page becomes empty
    const remainingItems = totalCount - 1;
    const maxPage = Math.ceil(remainingItems / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) {
      currentPage = maxPage;
    }
    
    loadExpenses();
    
    // Refresh leaderboard data if user is premium
    if (userIsPremium) {
      loadUserRank();
    }
    
    showSuccessMessage('Expense deleted successfully!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// ======================= PREMIUM MEMBERSHIP =======================
async function checkPremiumStatus() {
  if (!token) return;

  try {
    const res = await fetch(`${baseURL}/premium-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (res.ok && data.isPremium) {
      // User is premium
      userIsPremium = true;
      if (premiumBanner) premiumBanner.style.display = 'block';
      if (buyMembershipBtn) buyMembershipBtn.style.display = 'none';
      if (premiumFeaturesDiv) premiumFeaturesDiv.style.display = 'block';
      loadUserRank();
    } else {
      // User is not premium
      userIsPremium = false;
      if (premiumBanner) premiumBanner.style.display = 'none';
      if (buyMembershipBtn) buyMembershipBtn.style.display = 'inline-block';
      if (premiumFeaturesDiv) premiumFeaturesDiv.style.display = 'none';
    }
  } catch (err) {
    console.error('Error checking premium status:', err);
    if (buyMembershipBtn) buyMembershipBtn.style.display = 'inline-block';
  }
}

// Buy Premium Membership
if (buyMembershipBtn) {
  buyMembershipBtn.addEventListener('click', async () => {
    try {
      const originalText = buyMembershipBtn.innerHTML;
      buyMembershipBtn.disabled = true;
      buyMembershipBtn.innerHTML = '<div class="loading"></div> Processing...';

      const res = await fetch(`${baseURL}/buy-premium`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Initialize Cashfree
      const cashfree = Cashfree({
        mode: "sandbox",
      });

      const checkoutOptions = {
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      };

      // Open Cashfree checkout
      cashfree.checkout(checkoutOptions);

    } catch (err) {
      alert('Error: ' + err.message);
      buyMembershipBtn.disabled = false;
      buyMembershipBtn.innerHTML = '🚀 Upgrade to Premium - ₹499/year';
    }
  });
}

// ======================= PREMIUM FEATURES =======================
function initializePremiumFeatures() {
  // Report buttons
  const reportButtons = document.querySelectorAll('.report-btn');
  reportButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const reportType = btn.getAttribute('data-type');
      await downloadReport(reportType);
    });
  });

  // Leaderboard buttons
  const viewLeaderboardBtn = document.getElementById('view-leaderboard');
  const myRankBtn = document.getElementById('my-rank');
  const closeLeaderboardBtn = document.getElementById('close-leaderboard');

  if (viewLeaderboardBtn) {
    viewLeaderboardBtn.addEventListener('click', showLeaderboard);
  }

  if (myRankBtn) {
    myRankBtn.addEventListener('click', showMyRank);
  }

  if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener('click', () => {
      document.getElementById('leaderboard-modal').style.display = 'none';
    });
  }
}

async function downloadReport(type) {
  try {
    const btn = document.querySelector(`[data-type="${type}"]`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="loading"></div> Generating...';
    btn.disabled = true;

    // Download CSV report
    const res = await fetch(`${baseURL}/premium/reports/${type}?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Failed to generate report');
    }

    // Create download link
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-report-${type}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showSuccessMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} report downloaded successfully!`);

  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    const btn = document.querySelector(`[data-type="${type}"]`);
    btn.innerHTML = btn.getAttribute('data-type') === 'daily' ? '📅 Daily Report' :
                   btn.getAttribute('data-type') === 'weekly' ? '📊 Weekly Report' :
                   '📋 Monthly Report';
    btn.disabled = false;
  }
}

async function loadUserRank() {
  try {
    const res = await fetch(`${baseURL}/premium/my-rank`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      const userRankInfo = document.getElementById('user-rank-info');
      if (userRankInfo && data.success) {
        userRankInfo.innerHTML = `
          <div style="font-weight: 600; color: #2c3e50;">
            🏅 Rank: #${data.data.rank} of ${data.data.totalUsers}
          </div>
          <div style="color: #7f8c8d;">
            Total Spent: ₹${data.data.totalExpenses}
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Error loading user rank:', err);
  }
}

async function showLeaderboard() {
  try {
    const modal = document.getElementById('leaderboard-modal');
    const content = document.getElementById('leaderboard-content');
    
    content.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loading"></div> Loading leaderboard...</div>';
    modal.style.display = 'block';

    const res = await fetch(`${baseURL}/premium/leaderboard?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error('Failed to load leaderboard');
    }

    const data = await res.json();
    
    if (data.success) {
      let html = `
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="margin: 0;">🏆 Top Spenders</h4>
            <div style="font-size: 0.9rem; color: #7f8c8d;">
              Total Users: ${data.data.metadata.totalUsers}
            </div>
          </div>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
      `;

      data.data.leaderboard.forEach(user => {
        const isCurrentUser = user.userId === parseInt(localStorage.getItem('userId') || '0');
        html += `
          <div style="display: flex; align-items: center; padding: 12px; margin-bottom: 8px; background: ${isCurrentUser ? 'linear-gradient(135deg, rgba(241, 196, 15, 0.1), rgba(243, 156, 18, 0.1))' : '#f8f9fa'}; border-radius: 8px; border-left: 4px solid ${isCurrentUser ? '#f39c12' : '#e9ecef'};">
            <div style="font-weight: bold; font-size: 1.2rem; margin-right: 15px; color: ${user.rank <= 3 ? '#f39c12' : '#7f8c8d'};">
              ${user.rank <= 3 ? (user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : '🥉') : `#${user.rank}`}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #2c3e50; display: flex; align-items: center; gap: 8px;">
                ${user.name}
                ${user.isPremium ? '<span style="color: #f39c12;">👑</span>' : ''}
                ${isCurrentUser ? '<span style="color: #27ae60; font-size: 0.8rem;">(You)</span>' : ''}
              </div>
              <div style="font-size: 0.85rem; color: #7f8c8d;">
                ${user.badge} • ${user.expenseCount} expenses
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; color: #27ae60;">₹${user.totalExpenses}</div>
              ${user.lastExpenseDate ? `<div style="font-size: 0.8rem; color: #7f8c8d;">Last: ${user.lastExpenseDate}</div>` : ''}
            </div>
          </div>
        `;
      });

      html += '</div>';
      content.innerHTML = html;
    }

  } catch (err) {
    document.getElementById('leaderboard-content').innerHTML = `
      <div style="text-align: center; padding: 20px; color: #e74c3c;">
        <div style="font-size: 2rem; margin-bottom: 10px;">❌</div>
        <div>Error loading leaderboard: ${err.message}</div>
      </div>
    `;
  }
}

async function showMyRank() {
  try {
    const res = await fetch(`${baseURL}/premium/my-rank`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error('Failed to load rank data');
    }

    const data = await res.json();
    
    if (data.success) {
      const rankData = data.data;
      alert(`🏅 Your Rank: #${rankData.rank} out of ${rankData.totalUsers} users\n💰 Total Expenses: ₹${rankData.totalExpenses}\n📊 You're in the top ${rankData.percentile}% of spenders!`);
    }

  } catch (err) {
    alert('Error loading rank: ' + err.message);
  }
}

// Check payment status from URL parameters
function checkPaymentStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  const messageDiv = document.getElementById('payment-message');

  if (paymentStatus && messageDiv) {
    messageDiv.style.display = 'block';
    
    switch (paymentStatus) {
      case 'success':
        messageDiv.style.backgroundColor = '#d4edda';
        messageDiv.style.color = '#155724';
        messageDiv.style.border = '1px solid #c3e6cb';
        messageDiv.innerHTML = '🎉 Payment successful! You are now a Premium member!';
        setTimeout(() => {
          checkPremiumStatus();
          window.history.replaceState({}, document.title, window.location.pathname);
        }, 3000);
        break;
      case 'failed':
        messageDiv.style.backgroundColor = '#f8d7da';
        messageDiv.style.color = '#721c24';
        messageDiv.style.border = '1px solid #f5c6cb';
        messageDiv.innerHTML = '❌ Payment failed. Please try again.';
        break;
      case 'pending':
        messageDiv.style.backgroundColor = '#fff3cd';
        messageDiv.style.color = '#856404';
        messageDiv.style.border = '1px solid #ffeaa7';
        messageDiv.innerHTML = '⏳ Payment is pending. Please wait...';
        break;
      default:
        messageDiv.style.display = 'none';
    }

    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.style.display = 'none';
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 5000);
  }
}

function showSuccessMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #27ae60, #2ecc71);
    color: white;
    padding: 15px 20px;
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(39, 174, 96, 0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  messageDiv.innerHTML = `✅ ${message}`;
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

// ======================= LOGOUT =======================

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
    }
  });
}

if (!token && window.location.pathname.includes('dashboard.html')) {
  window.location.href = 'login.html';
}
function initializeFilters() {
  // Search input with debounce
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        currentPage = 1; // Reset to first page
        loadExpenses();
      }, 500); // 500ms debounce
    });
  }

  // Category filter
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      currentFilters.category = e.target.value;
      currentPage = 1;
      loadExpenses();
    });
  }

  // Sort by
  if (sortBySelect) {
    sortBySelect.addEventListener('change', (e) => {
      currentFilters.sortBy = e.target.value;
      currentPage = 1;
      loadExpenses();
    });
  }

  // Sort order
  if (sortOrderSelect) {
    sortOrderSelect.addEventListener('change', (e) => {
      currentFilters.sortOrder = e.target.value;
      // Update the text based on sort field and order
      updateSortOrderText();
      currentPage = 1;
      loadExpenses();
    });
  }

  // Items per page event listener is handled in initializePagination()
}

function updateSortOrderText() {
  if (!sortOrderSelect || !sortBySelect) return;
  
  const sortBy = sortBySelect.value;
  const sortOrder = sortOrderSelect.value;
  
  const options = sortOrderSelect.querySelectorAll('option');
  
  if (sortBy === 'createdAt') {
    options[0].textContent = 'Newest First';
    options[1].textContent = 'Oldest First';
  } else if (sortBy === 'amount') {
    options[0].textContent = 'Highest First';
    options[1].textContent = 'Lowest First';
  } else {
    options[0].textContent = 'Z to A';
    options[1].textContent = 'A to Z';
  }
}

async function loadExpenses() {
  console.log('🟢 FUNCTION 2: loadExpenses called (with filtering) - itemsPerPage:', itemsPerPage, 'currentPage:', currentPage);
  if (!expenseTableBody || !token) return;

  try {
    // Show loading state
    showExpensesLoading(true);

    // Build query parameters
    const params = new URLSearchParams({
      page: currentPage,
      limit: itemsPerPage,
      sortBy: currentFilters.sortBy,
      sortOrder: currentFilters.sortOrder
    });

    if (currentFilters.search) {
      params.append('search', currentFilters.search);
    }
    if (currentFilters.category) {
      params.append('category', currentFilters.category);
    }

    const res = await fetch(`${baseURL}/expenses?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const response = await res.json();
    if (!res.ok) throw new Error(response.message || 'Failed to load expenses');

    console.log('📊 API Response received:', response);

    // Server returns { expenses, pagination } directly, not wrapped in data
    const { expenses, pagination } = response;

    console.log(`📊 Parsed: ${expenses.length} expenses, pagination:`, pagination);

    // Update pagination state
    currentPage = pagination.currentPage;
    totalPages = pagination.totalPages;
    totalCount = pagination.totalCount;

    // Clear table
    expenseTableBody.innerHTML = '';

    if (expenses.length === 0) {
      showNoExpenses(true);
      showExpensesTable(false);
      updatePaginationInfo(pagination);
      return;
    }

    showNoExpenses(false);
    showExpensesTable(true);

    // Populate table
    expenses.forEach((exp) => {
      const row = document.createElement('tr');
      const createdDate = new Date(exp.createdAt).toLocaleDateString('en-IN');
      const categoryEmoji = getCategoryEmoji(exp.categories);
      
      row.innerHTML = `
        <td style="font-weight: 600; color: #27ae60;">₹${parseFloat(exp.amount).toFixed(2)}</td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${exp.description}">${exp.description}</td>
        <td>${categoryEmoji} ${exp.categories}</td>
        <td style="color: #7f8c8d; font-size: 0.9rem;">${createdDate}</td>
        <td>
          <button class="edit-btn" onclick="editExpense(${exp.id}, ${exp.amount}, '${exp.description.replace(/'/g, "\\'")}', '${exp.categories}', '${exp.splitWith}')">
            ✏️ Edit
          </button>
          <button class="delete-btn" onclick="deleteExpense(${exp.id})">
            🗑️ Delete
          </button>
        </td>
      `;
      expenseTableBody.appendChild(row);
    });

    // Update pagination controls
    updatePaginationInfo(pagination);
    updatePaginationButtons(pagination);

  } catch (err) {
    console.error('Error loading expenses:', err.message);
    showError('expenses-error', err.message);
  } finally {
    showExpensesLoading(false);
  }
}

function showExpensesLoading(show) {
  if (expensesLoadingDiv) {
    expensesLoadingDiv.style.display = show ? 'block' : 'none';
  }
}

function showNoExpenses(show) {
  if (noExpensesDiv) {
    noExpensesDiv.style.display = show ? 'block' : 'none';
  }
}

function showExpensesTable(show) {
  const expenseTable = document.getElementById('expenseTable');
  if (expenseTable) {
    expenseTable.style.display = show ? 'table' : 'none';
  }
}

function updatePaginationInfo(pagination) {
  const paginationInfo = document.getElementById('pagination-info');
  if (!paginationInfo) return;

  const start = pagination.totalCount === 0 ? 0 : (pagination.currentPage - 1) * pagination.limit + 1;
  const end = Math.min(pagination.currentPage * pagination.limit, pagination.totalCount);

  paginationInfo.innerHTML = `
    Showing ${start}-${end} of ${pagination.totalCount} expenses
    ${currentFilters.search || currentFilters.category ? '(filtered)' : ''}
  `;
}

function updatePaginationButtons(pagination) {
  const paginationButtons = document.getElementById('pagination-buttons');
  if (!paginationButtons) return;

  paginationButtons.innerHTML = '';

  if (pagination.totalPages <= 1) return;

  // Previous button
  const prevBtn = createPaginationButton('‹ Previous', pagination.currentPage - 1, !pagination.hasPrevPage);
  paginationButtons.appendChild(prevBtn);

  // Page numbers
  const startPage = Math.max(1, pagination.currentPage - 2);
  const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);

  // First page if not in range
  if (startPage > 1) {
    paginationButtons.appendChild(createPaginationButton('1', 1));
    if (startPage > 2) {
      paginationButtons.appendChild(createPaginationButton('...', null, true));
    }
  }

  // Page range
  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === pagination.currentPage;
    paginationButtons.appendChild(createPaginationButton(i.toString(), i, false, isActive));
  }

  // Last page if not in range
  if (endPage < pagination.totalPages) {
    if (endPage < pagination.totalPages - 1) {
      paginationButtons.appendChild(createPaginationButton('...', null, true));
    }
    paginationButtons.appendChild(createPaginationButton(pagination.totalPages.toString(), pagination.totalPages));
  }

  // Next button
  const nextBtn = createPaginationButton('Next ›', pagination.currentPage + 1, !pagination.hasNextPage);
  paginationButtons.appendChild(nextBtn);
}

function createPaginationButton(text, page, disabled = false, active = false) {
  const button = document.createElement('button');
  button.textContent = text;
  button.disabled = disabled;
  
  button.style.cssText = `
    padding: 8px 12px;
    margin: 0 2px;
    border: 1px solid #ddd;
    background: ${active ? '#667eea' : disabled ? '#f8f9fa' : 'white'};
    color: ${active ? 'white' : disabled ? '#6c757d' : '#495057'};
    border-radius: 4px;
    cursor: ${disabled ? 'not-allowed' : 'pointer'};
    font-size: 0.9rem;
    transition: all 0.2s ease;
  `;

  if (!disabled && !active) {
    button.addEventListener('mouseenter', () => {
      button.style.background = '#e9ecef';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'white';
    });
  }

  if (!disabled && page !== null) {
    button.addEventListener('click', () => {
      currentPage = page;
      loadExpenses();
    });
  }

  return button;
}
async function checkPremiumStatus() {
  if (!token) return;

  try {
    const res = await fetch(`${baseURL}/premium-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (res.ok && data.isPremium) {
      // User is premium
      userIsPremium = true;
      if (premiumBanner) premiumBanner.style.display = 'block';
      if (buyMembershipBtn) buyMembershipBtn.style.display = 'none';
      if (premiumFeaturesDiv) premiumFeaturesDiv.style.display = 'block';
      loadUserRank();
    } else {
      // User is not premium
      userIsPremium = false;
      if (premiumBanner) premiumBanner.style.display = 'none';
      if (buyMembershipBtn) buyMembershipBtn.style.display = 'inline-block';
      if (premiumFeaturesDiv) premiumFeaturesDiv.style.display = 'none';
    }
  } catch (err) {
    console.error('Error checking premium status:', err);
    if (buyMembershipBtn) buyMembershipBtn.style.display = 'inline-block';
  }
}

// Buy Premium Membership
if (buyMembershipBtn) {
  buyMembershipBtn.addEventListener('click', async () => {
    try {
      const originalText = buyMembershipBtn.innerHTML;
      buyMembershipBtn.disabled = true;
      buyMembershipBtn.innerHTML = '<div class="loading"></div> Processing...';

      const res = await fetch(`${baseURL}/buy-premium`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Initialize Cashfree
      const cashfree = Cashfree({
        mode: "sandbox",
      });

      const checkoutOptions = {
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      };

      // Open Cashfree checkout
      cashfree.checkout(checkoutOptions);

    } catch (err) {
      alert('Error: ' + err.message);
      buyMembershipBtn.disabled = false;
      buyMembershipBtn.innerHTML = '🚀 Upgrade to Premium - ₹499/year';
    }
  });
}

// ======================= PREMIUM FEATURES =======================
function initializePremiumFeatures() {
  // Report buttons
  const reportButtons = document.querySelectorAll('.report-btn');
  reportButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const reportType = btn.getAttribute('data-type');
      await downloadReport(reportType);
    });
  });

  // Leaderboard buttons
  const viewLeaderboardBtn = document.getElementById('view-leaderboard');
  const myRankBtn = document.getElementById('my-rank');
  const closeLeaderboardBtn = document.getElementById('close-leaderboard');

  if (viewLeaderboardBtn) {
    viewLeaderboardBtn.addEventListener('click', showLeaderboard);
  }

  if (myRankBtn) {
    myRankBtn.addEventListener('click', showMyRank);
  }

  if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener('click', () => {
      document.getElementById('leaderboard-modal').style.display = 'none';
    });
  }
}

async function downloadReport(type) {
  try {
    const btn = document.querySelector(`[data-type="${type}"]`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="loading"></div> Generating...';
    btn.disabled = true;

    // Download CSV report
    const res = await fetch(`${baseURL}/premium/reports/${type}?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Failed to generate report');
    }

    // Create download link
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-report-${type}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showSuccessMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} report downloaded successfully!`);

  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    const btn = document.querySelector(`[data-type="${type}"]`);
    btn.innerHTML = btn.getAttribute('data-type') === 'daily' ? '📅 Daily Report' :
                   btn.getAttribute('data-type') === 'weekly' ? '📊 Weekly Report' :
                   '📋 Monthly Report';
    btn.disabled = false;
  }
}

async function loadUserRank() {
  try {
    const res = await fetch(`${baseURL}/premium/my-rank`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      const userRankInfo = document.getElementById('user-rank-info');
      if (userRankInfo && data.success) {
        userRankInfo.innerHTML = `
          <div style="font-weight: 600; color: #2c3e50;">
            🏅 Rank: #${data.data.rank} of ${data.data.totalUsers}
          </div>
          <div style="color: #7f8c8d;">
            Total Spent: ₹${data.data.totalExpenses}
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Error loading user rank:', err);
  }
}

async function showLeaderboard() {
  try {
    const modal = document.getElementById('leaderboard-modal');
    const content = document.getElementById('leaderboard-content');
    
    content.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loading"></div> Loading leaderboard...</div>';
    modal.style.display = 'block';

    const res = await fetch(`${baseURL}/premium/leaderboard?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error('Failed to load leaderboard');
    }

    const data = await res.json();
    
    if (data.success) {
      let html = `
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="margin: 0;">🏆 Top Spenders</h4>
            <div style="font-size: 0.9rem; color: #7f8c8d;">
              Total Users: ${data.data.metadata.totalUsers}
            </div>
          </div>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
      `;

      data.data.leaderboard.forEach(user => {
        const isCurrentUser = user.userId === parseInt(localStorage.getItem('userId') || '0');
        html += `
          <div style="display: flex; align-items: center; padding: 12px; margin-bottom: 8px; background: ${isCurrentUser ? 'linear-gradient(135deg, rgba(241, 196, 15, 0.1), rgba(243, 156, 18, 0.1))' : '#f8f9fa'}; border-radius: 8px; border-left: 4px solid ${isCurrentUser ? '#f39c12' : '#e9ecef'};">
            <div style="font-weight: bold; font-size: 1.2rem; margin-right: 15px; color: ${user.rank <= 3 ? '#f39c12' : '#7f8c8d'};">
              ${user.rank <= 3 ? (user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : '🥉') : `#${user.rank}`}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #2c3e50; display: flex; align-items: center; gap: 8px;">
                ${user.name}
                ${user.isPremium ? '<span style="color: #f39c12;">👑</span>' : ''}
                ${isCurrentUser ? '<span style="color: #27ae60; font-size: 0.8rem;">(You)</span>' : ''}
              </div>
              <div style="font-size: 0.85rem; color: #7f8c8d;">
                ${user.badge} • ${user.expenseCount} expenses
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; color: #27ae60;">₹${user.totalExpenses}</div>
              ${user.lastExpenseDate ? `<div style="font-size: 0.8rem; color: #7f8c8d;">Last: ${user.lastExpenseDate}</div>` : ''}
            </div>
          </div>
        `;
      });

      html += '</div>';
      content.innerHTML = html;
    }

  } catch (err) {
    document.getElementById('leaderboard-content').innerHTML = `
      <div style="text-align: center; padding: 20px; color: #e74c3c;">
        <div style="font-size: 2rem; margin-bottom: 10px;">❌</div>
        <div>Error loading leaderboard: ${err.message}</div>
      </div>
    `;
  }
}

async function showMyRank() {
  try {
    const res = await fetch(`${baseURL}/premium/my-rank`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error('Failed to load rank data');
    }

    const data = await res.json();
    
    if (data.success) {
      const rankData = data.data;
      alert(`🏅 Your Rank: #${rankData.rank} out of ${rankData.totalUsers} users\n💰 Total Expenses: ₹${rankData.totalExpenses}\n📊 You're in the top ${rankData.percentile}% of spenders!`);
    }

  } catch (err) {
    alert('Error loading rank: ' + err.message);
  }
}

// Check payment status from URL parameters
function checkPaymentStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  const messageDiv = document.getElementById('payment-message');

  if (paymentStatus && messageDiv) {
    messageDiv.style.display = 'block';
    
    switch (paymentStatus) {
      case 'success':
        messageDiv.style.backgroundColor = '#d4edda';
        messageDiv.style.color = '#155724';
        messageDiv.style.border = '1px solid #c3e6cb';
        messageDiv.innerHTML = '🎉 Payment successful! You are now a Premium member!';
        setTimeout(() => {
          checkPremiumStatus();
          window.history.replaceState({}, document.title, window.location.pathname);
        }, 3000);
        break;
      case 'failed':
        messageDiv.style.backgroundColor = '#f8d7da';
        messageDiv.style.color = '#721c24';
        messageDiv.style.border = '1px solid #f5c6cb';
        messageDiv.innerHTML = '❌ Payment failed. Please try again.';
        break;
      case 'pending':
        messageDiv.style.backgroundColor = '#fff3cd';
        messageDiv.style.color = '#856404';
        messageDiv.style.border = '1px solid #ffeaa7';
        messageDiv.innerHTML = '⏳ Payment is pending. Please wait...';
        break;
      default:
        messageDiv.style.display = 'none';
    }

    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.style.display = 'none';
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 5000);
  }
}

function showSuccessMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #27ae60, #2ecc71);
    color: white;
    padding: 15px 20px;
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(39, 174, 96, 0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  messageDiv.innerHTML = `✅ ${message}`;
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

function getCategoryEmoji(category) {
  const emojis = {
    fashion: '👗',
    food: '🍕',
    fuel: '⛽',
    entertainment: '🎬',
    healthcare: '🏥',
    education: '📚',
    other: '📦'
  };
  return emojis[category] || '📦';
}

window.editExpense = function (id, amount, description, categories, splitWith) {
  if (amountInput) amountInput.value = amount;
  if (descriptionInput) descriptionInput.value = description;
  if (categoryInput) categoryInput.value = categories;
  if (splitWithInput) splitWithInput.value = splitWith.replace(/[\[\]\s]/g, '');

  editMode = true;
  editingId = id;
  if (formBtnText) formBtnText.textContent = 'Update Expense';
  
  // Scroll to form and highlight it
  if (expenseForm) {
    expenseForm.scrollIntoView({ behavior: 'smooth' });
    expenseForm.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.3)';
    setTimeout(() => {
      expenseForm.style.boxShadow = '';
    }, 2000);
  }
};

window.deleteExpense = async function (id) {
  if (!confirm('Are you sure you want to delete this expense?')) return;
  
  try {
    const res = await fetch(`${baseURL}/expenses/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete');
    
    // Reload current page, but go to previous page if current page becomes empty
    const remainingItems = totalCount - 1;
    const maxPage = Math.ceil(remainingItems / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) {
      currentPage = maxPage;
    }
    
    loadExpenses();
    
    // Refresh leaderboard data if user is premium
    if (userIsPremium) {
      loadUserRank();
    }
    
    showSuccessMessage('Expense deleted successfully!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// ======================= LOGOUT =======================

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
    }
  });
}

if (!token && window.location.pathname.includes('dashboard.html')) {
  window.location.href = 'login.html';
}