/* ==========================================================================
   AI Consent Guardian — Client-Side JavaScript
   Handles Tabs, Drag & Drop, API requests, Results Rendering, and Ask AI
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const policyTextarea = document.getElementById('policy_text');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file_input');
  const selectedFileInfo = document.getElementById('selected_file_info');
  const fileNameDisplay = document.getElementById('file_name');
  
  const analyzeBtn = document.getElementById('analyze_btn');
  const analyzeForm = document.getElementById('analyze_form');
  const errorAlert = document.getElementById('error_alert');
  const errorMessage = document.getElementById('error_message');
  const loadingOverlay = document.getElementById('loading_overlay');
  const resultsContainer = document.getElementById('results_container');

  // Stored analysis context for Ask AI
  let currentPolicyText = '';

  // --------------------------------------------------------------------------
  // 1. TAB SWITCHING (Paste Text vs Upload File)
  // --------------------------------------------------------------------------
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`${targetTab}_tab`).classList.add('active');
      
      hideError();
    });
  });

  // --------------------------------------------------------------------------
  // 2. FILE SELECTION & DRAG AND DROP
  // --------------------------------------------------------------------------
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFileSelect(fileInput.files[0]);
      }
    });
  }

  function handleFileSelect(file) {
    hideError();
    
    // Check file type
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'txt' && ext !== 'pdf') {
      showError('Invalid file type. Only TXT and PDF documents are allowed.');
      fileInput.value = '';
      selectedFileInfo.style.display = 'none';
      return;
    }

    // Check size limit (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('File size exceeds 5 MB. Please upload a smaller document.');
      fileInput.value = '';
      selectedFileInfo.style.display = 'none';
      return;
    }

    fileNameDisplay.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    selectedFileInfo.style.display = 'inline-flex';
  }

  // --------------------------------------------------------------------------
  // 3. ERROR MESSAGES
  // --------------------------------------------------------------------------
  function showError(msg) {
    if (errorMessage && errorAlert) {
      errorMessage.textContent = msg;
      errorAlert.style.display = 'flex';
      errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function hideError() {
    if (errorAlert) {
      errorAlert.style.display = 'none';
    }
  }

  // --------------------------------------------------------------------------
  // 4. FORM SUBMISSION & API REQUEST (/analyze)
  // --------------------------------------------------------------------------
  if (analyzeForm) {
    analyzeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
      const textVal = policyTextarea ? policyTextarea.value.trim() : '';
      const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;

      // Validation
      if (activeTab === 'text' && (!textVal || textVal.length < 30)) {
        showError('Please paste your policy text (at least 30 characters).');
        return;
      }
      if (activeTab === 'file' && !hasFile) {
        showError('Please select or drop a TXT or PDF file to analyze.');
        return;
      }

      // Store raw text if pasted
      currentPolicyText = activeTab === 'text' ? textVal : '';

      // UI Loading State
      setLoading(true);

      // Prepare Form Data
      const formData = new FormData();
      if (activeTab === 'text') {
        formData.append('policy_text', textVal);
      } else if (hasFile) {
        formData.append('file', fileInput.files[0]);
      }

      try {
        const response = await fetch('/analyze', {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
          },
          body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Analysis failed. Please try again.');
        }

        // Render Results Dashboard
        renderResults(result.data);

        // Save context text if file was parsed server-side
        if (result.raw_text_length) {
          // If we uploaded a file, we can populate currentPolicyText for Ask AI questions
          if (activeTab === 'text') {
            currentPolicyText = textVal;
          } else {
            currentPolicyText = "Extracted policy document text.";
          }
        }

      } catch (err) {
        showError(err.message || 'An error occurred during policy analysis.');
      } finally {
        setLoading(false);
      }
    });
  }

  function setLoading(isLoading) {
    if (analyzeBtn) analyzeBtn.disabled = isLoading;
    if (loadingOverlay) loadingOverlay.style.display = isLoading ? 'block' : 'none';
  }

  // --------------------------------------------------------------------------
  // 5. RENDER RESULTS DASHBOARD
  // --------------------------------------------------------------------------
  function renderResults(data) {
    if (!resultsContainer) return;

    const riskLevel = (data.risk_level || 'Medium').toLowerCase();
    const riskScore = data.risk_score !== undefined ? data.risk_score : 50;
    
    let riskClass = 'risk-medium';
    let riskColor = 'var(--risk-medium)';

    if (riskLevel.includes('low')) {
      riskClass = 'risk-low';
      riskColor = 'var(--risk-low)';
    } else if (riskLevel.includes('high')) {
      riskClass = 'risk-high';
      riskColor = 'var(--risk-high)';
    }

    const html = `
      <div class="results-dashboard" id="dashboard_view">
        <div class="dashboard-header">
          <!-- Risk Score Gauge Card -->
          <div class="score-card">
            <h3 style="font-size:0.9rem; text-transform:uppercase; color:var(--text-muted); letter-spacing:1px;">Privacy Risk Score</h3>
            <div class="gauge-container">
              <div class="gauge-circle" style="border-color: ${riskColor};">
                <span class="gauge-score" style="color: ${riskColor};">${riskScore}</span>
                <span class="gauge-max">/ 100</span>
              </div>
            </div>
            <span class="risk-badge ${riskClass}">${data.risk_level || 'Medium'} Risk</span>
          </div>

          <!-- Executive Summary Card -->
          <div class="summary-card">
            <h3 class="summary-title">AI Summary</h3>
            <p class="summary-text">${escapeHtml(data.summary)}</p>
          </div>
        </div>

        <!-- Detailed Breakdown Grid -->
        <div class="details-grid">
          <!-- What Data Is Collected -->
          <div class="card">
            <h4 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
              What Data Is Collected?
            </h4>
            <div class="tag-list">
              ${renderTags(data.data_collected)}
            </div>
          </div>

          <!-- Permissions Required -->
          <div class="card">
            <h4 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Permissions Required
            </h4>
            <div class="tag-list">
              ${renderTags(data.permissions)}
            </div>
          </div>

          <!-- Is Your Data Shared -->
          <div class="card">
            <h4 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              Data Sharing
            </h4>
            <ul class="feature-list">
              ${renderListItems(data.data_sharing, 'bullet')}
            </ul>
          </div>

          <!-- Tracking & Advertising -->
          <div class="card">
            <h4 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Tracking & Advertising
            </h4>
            <ul class="feature-list">
              ${renderListItems(data.tracking_and_advertising, 'bullet')}
            </ul>
          </div>

          <!-- Data Retention -->
          <div class="card">
            <h4 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Data Retention
            </h4>
            <p style="font-size:0.95rem; color:var(--text-main); margin-top:0.5rem;">${escapeHtml(data.data_retention || 'Not clearly mentioned')}</p>
          </div>

          <!-- User Rights -->
          <div class="card">
            <h4 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              User Rights
            </h4>
            <ul class="feature-list">
              ${renderListItems(data.user_rights, 'positive')}
            </ul>
          </div>
        </div>

        <!-- Red Flags & Positive Points Grid -->
        <div class="details-grid">
          <!-- Red Flags -->
          <div class="card flag-card-red">
            <h4 class="card-title" style="color:var(--risk-high);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Privacy Red Flags
            </h4>
            <ul class="feature-list">
              ${renderListItems(data.red_flags, 'red_flag')}
            </ul>
          </div>

          <!-- Positive Practices -->
          <div class="card flag-card-green">
            <h4 class="card-title" style="color:var(--risk-low);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Positive Privacy Practices
            </h4>
            <ul class="feature-list">
              ${renderListItems(data.positive_points, 'positive')}
            </ul>
          </div>
        </div>

        <!-- Recommendation Box -->
        <div class="recommendation-card">
          <h4 class="recommendation-heading">Should You Accept?</h4>
          <p style="font-size:1.05rem; line-height:1.6; color:var(--text-main);">${escapeHtml(data.recommendation)}</p>
          <div class="disclaimer-text">
            <strong>Disclaimer:</strong> AI Consent Guardian provides informational privacy analysis using artificial intelligence and does not constitute formal legal advice.
          </div>
        </div>

        <!-- Ask AI Interactive Section -->
        <div class="ask-ai-card">
          <h4 class="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Ask about this policy...
          </h4>
          <p style="font-size:0.9rem; color:var(--text-muted);">Ask any specific question regarding what happens to your data under this document.</p>
          
          <form class="ask-form" id="ask_form">
            <input type="text" class="ask-input" id="ask_input" placeholder="e.g. Does this policy allow sharing my location with advertisers?" required>
            <button type="submit" class="btn-ask" id="ask_btn">Ask AI</button>
          </form>

          <div class="ask-response-box" id="ask_response_box"></div>
        </div>
      </div>
    `;

    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Attach Ask AI Listener
    setupAskAIListener();
  }

  function renderTags(arr) {
    if (!arr || !Array.isArray(arr) || arr.length === 0) {
      return '<span class="tag" style="color:var(--text-dim);">Not clearly mentioned</span>';
    }
    return arr.map(item => `<span class="tag">${escapeHtml(item)}</span>`).join('');
  }

  function renderListItems(arr, type) {
    if (!arr || !Array.isArray(arr) || arr.length === 0) {
      return '<li class="feature-item" style="color:var(--text-dim);">Not clearly mentioned</li>';
    }

    let iconHtml = '';
    if (type === 'red_flag') {
      iconHtml = `<svg class="icon-red-flag" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else if (type === 'positive') {
      iconHtml = `<svg class="icon-positive" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
      iconHtml = `<svg class="icon-bullet" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"></circle></svg>`;
    }

    return arr.map(item => `<li class="feature-item">${iconHtml}<span>${escapeHtml(item)}</span></li>`).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  // --------------------------------------------------------------------------
  // 6. ASK AI FEATURE (/ask)
  // --------------------------------------------------------------------------
  function setupAskAIListener() {
    const askForm = document.getElementById('ask_form');
    const askInput = document.getElementById('ask_input');
    const askBtn = document.getElementById('ask_btn');
    const askResponseBox = document.getElementById('ask_response_box');

    if (!askForm) return;

    askForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = askInput.value.trim();
      if (!question) return;

      askBtn.disabled = true;
      askBtn.textContent = 'Thinking...';
      askResponseBox.style.display = 'block';
      askResponseBox.textContent = 'Analyzing document for your answer...';

      // Fallback policy text if user directly typed text in textarea
      const activeTextarea = document.getElementById('policy_text');
      const textVal = activeTextarea ? activeTextarea.value.trim() : '';
      const payloadText = currentPolicyText || textVal || 'Standard policy text.';

      try {
        const res = await fetch('/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            policy_text: payloadText,
            question: question
          })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to answer question.');
        }

        askResponseBox.innerHTML = `<strong>Answer:</strong> ${escapeHtml(data.answer)}`;
      } catch (err) {
        askResponseBox.innerHTML = `<span style="color:var(--risk-high);">Error: ${escapeHtml(err.message)}</span>`;
      } finally {
        askBtn.disabled = false;
        askBtn.textContent = 'Ask AI';
      }
    });
  }

});
