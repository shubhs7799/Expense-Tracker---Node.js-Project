function initializePagination() {
  console.log('Initializing pagination...');
  
  // Items per page - Remove any existing event listeners first
  itemsPerPageSelect = document.getElementById('items-per-page');
  
  if (itemsPerPageSelect) {
    console.log('Items per page selector found, setting up event listener');
    
    // // Clone the element to remove all existing event listeners
    // const newSelect = itemsPerPageSelect.cloneNode(true);
    // itemsPerPageSelect.parentNode.replaceChild(newSelect, itemsPerPageSelect);
    
    // Update the global reference to the new element
    itemsPerPageSelect = document.getElementById('items-per-page');
    
    // Add single event listener
    itemsPerPageSelect.addEventListener('change', (e) => {
      const newItemsPerPage = parseInt(e.target.value);
      console.log(`Items per page changed from ${itemsPerPage} to ${newItemsPerPage}`);
      itemsPerPage = newItemsPerPage;
      currentPage = 1; // Reset to first page
      loadExpenses();
    });
  } else {
    console.log('Items per page selector not found');
  }
}

async function loadExpenses_OLD_UNUSED() {
  console.log('🔵 FUNCTION 1: loadExpenses called');
  if (!expenseTableBody || !token) {
    console.log('Missing expenseTableBody or token');
    return;
  }

  try {
    console.log(`Loading expenses - Page: ${currentPage}, Limit: ${itemsPerPage}`);
    
    // Show loading state
    showExpensesLoading(true);

    // Build query parameters
    const params = new URLSearchParams({
      page: currentPage,
      limit: itemsPerPage
    });

    console.log(`API Request params: page=${currentPage}, limit=${itemsPerPage}`);

    const res = await fetch(`${baseURL}/expenses?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    console.log('API Response:', data);
    
    if (!res.ok) throw new Error(data.message || 'Failed to load expenses');

    const { expenses, pagination } = data;

    if (!expenses || !pagination) {
      throw new Error('Invalid response format');
    }

    // Update pagination state
    currentPage = pagination.currentPage;
    totalPages = pagination.totalPages;
    totalCount = pagination.totalCount;

    console.log(`Loaded ${expenses.length} expenses, Page ${currentPage}/${totalPages}`);

    // Clear table
    expenseTableBody.innerHTML = '';

    if (expenses.length === 0) {
      showNoExpenses(true);
      showExpensesTable(false);
      updatePaginationInfo(pagination);
      updatePaginationButtons(pagination);
      return;
    }

    showNoExpenses(false);
    showExpensesTable(true);

    // Populate table
    expenses.forEach((exp) => {
      const row = document.createElement('tr');
      const createdDate = new Date(exp.createdAt).toLocaleDateString('en-IN');
      const categoryEmoji = getCategoryEmoji(exp.categories);
      
      // Escape description for HTML
      const safeDescription = exp.description.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
      
      row.innerHTML = `
        <td style="font-weight: 600; color: var(--success-color);">₹${parseFloat(exp.amount).toFixed(2)}</td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${safeDescription}">${exp.description}</td>
        <td>${categoryEmoji} ${exp.categories}</td>
        <td style="color: var(--gray-500); font-size: 0.875rem;">${createdDate}</td>
        <td>
          <button class="edit-btn" onclick="editExpense(${exp.id}, ${exp.amount}, '${safeDescription}', '${exp.categories}', '${exp.splitWith}')">
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
    console.error('Error loading expenses:', err);
    showError('expenses-error', 'Failed to load expenses: ' + err.message);
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
  const paginationContainer = document.getElementById('pagination-container');
  
  if (!paginationInfo) return;

  const start = pagination.totalCount === 0 ? 0 : (pagination.currentPage - 1) * pagination.limit + 1;
  const end = Math.min(pagination.currentPage * pagination.limit, pagination.totalCount);

  paginationInfo.innerHTML = `Showing ${start}-${end} of ${pagination.totalCount} expenses`;
  
  // Show pagination container if there are expenses
  if (paginationContainer) {
    paginationContainer.style.display = pagination.totalCount > 0 ? 'flex' : 'none';
  }
}

function updatePaginationButtons(pagination) {
  const paginationButtons = document.getElementById('pagination-buttons');
  if (!paginationButtons) return;

  paginationButtons.innerHTML = '';

  // Only show buttons if there are multiple pages
  if (pagination.totalPages <= 1) return;

  // Previous button (only show if not on first page)
  if (pagination.hasPrevPage) {
    const prevBtn = createPaginationButton('← Previous', pagination.currentPage - 1);
    paginationButtons.appendChild(prevBtn);
  }

  // Next button (only show if not on last page)
  if (pagination.hasNextPage) {
    const nextBtn = createPaginationButton('Next →', pagination.currentPage + 1);
    paginationButtons.appendChild(nextBtn);
  }
}

function createPaginationButton(text, page) {
  const button = document.createElement('button');
  button.textContent = text;
  
  // Use the professional CSS classes instead of inline styles
  button.className = 'pagination-btn';
  
  button.addEventListener('click', () => {
    currentPage = page;
    loadExpenses();
  });

  return button;
}