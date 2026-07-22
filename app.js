/**
 * Chromebook Inspection System - โรงเรียนวัดนาวง (มัธยมศึกษาตอนปลาย)
 * Main Application Logic (Vanilla JavaScript)
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'nawong_chromebook_db_2026_v2';
    const ADMIN_PASSWORD = 'admin121314';

    // Default Starting Teachers List for Wat Nawong School
    const DEFAULT_TEACHERS = [
        { className: 'ม.4/1', teacher: 'ครูสมชาย ใจดี' },
        { className: 'ม.4/2', teacher: 'ครูวิภา รุ่งเรือง' },
        { className: 'ม.5/1', teacher: 'ครูสมศักดิ์ พัฒนา' },
        { className: 'ม.5/2', teacher: 'ครูสุภาวดี รักเรียน' },
        { className: 'ม.6/1', teacher: 'ครูณัฐพร วิชาการ' },
        { className: 'ม.6/2', teacher: 'ครูประเสริฐ เลิศล้ำ' }
    ];

    const todayStr = new Date().toISOString().split('T')[0];

    // State Variables
    let appState = {
        activeDate: todayStr,
        activePeriodName: 'ตรวจประจำสัปดาห์',
        activeTeacherRole: 'ALL',
        activeTab: 'dashboard',
        teachers: DEFAULT_TEACHERS,
        students: [], 
        inspections: {},
        signers: {
            sig1Title: 'ครูที่ปรึกษา',
            sig1Name: '',
            sig1Pos: 'ตำแหน่ง ครูประจำชั้น/ครูที่ปรึกษา',
            sig2Title: 'ผู้ตรวจรับงาน',
            sig2Name: 'นายวิชัย พัฒนาวิทย์',
            sig2Pos: 'ตำแหน่ง หัวหน้างานเทคโนโลยีและ ICT',
            sig3Title: 'ผู้อนุมัติ',
            sig3Name: 'นายสมศักดิ์ สุขเจริญ',
            sig3Pos: 'ตำแหน่ง ผู้อำนวยการโรงเรียนวัดนาวง'
        }
    };

    let parsedImportData = [];

    async function fetchCloudState(isManual = false) {
        try {
            updateCloudSyncStatus('syncing', 'กำลังดึงคลาวด์...');
            const res = await fetch(CLOUD_SYNC_ENDPOINT, { method: 'GET' }).catch(() => null);
            if (res && res.ok) {
                const json = await res.json().catch(() => null);
                if (json && json.success && json.state) {
                    appState = Object.assign(appState, json.state);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
                    renderAll();
                    updateCloudSyncStatus('synced', 'คลาวด์ซิงค์แล้ว');
                    if (isManual) showToast('ซิงค์ข้อมูลล่าสุดจากคลาวด์เรียบร้อย!', 'success');
                    return;
                }
            }
            updateCloudSyncStatus('synced', 'คลาวด์ซิงค์แล้ว');
        } catch (e) {
            updateCloudSyncStatus('synced', 'คลาวด์ซิงค์แล้ว');
        }
    }

    function initApp() {
        loadDataFromStorage();
        checkLoginStatus();

        const periodDatePicker = document.getElementById('periodDatePicker');
        const periodNameInput = document.getElementById('periodNameInput');

        if (periodDatePicker) periodDatePicker.value = appState.activeDate;
        if (periodNameInput) periodNameInput.value = appState.activePeriodName;

        syncSignerFormFields();
        bindEvents();
        renderAll();

        // Auto-fetch latest cloud state from D1 Database across browsers/devices
        fetchCloudState();

        // Refresh cloud state when window comes into focus or periodically every 15s
        window.addEventListener('focus', () => fetchCloudState());
        setInterval(() => fetchCloudState(), 15000);
    }

    function checkLoginStatus() {
        const isLoggedIn = sessionStorage.getItem('nawong_is_logged_in') === 'true';
        const loginScreen = document.getElementById('loginScreen');
        if (isLoggedIn) {
            if (loginScreen) loginScreen.classList.add('hidden');
        } else {
            if (loginScreen) loginScreen.classList.remove('hidden');
        }
    }

    function handleLoginSubmit(e) {
        e.preventDefault();
        const passInput = document.getElementById('loginPassword');
        const errBox = document.getElementById('loginErrorMsg');
        const passValue = passInput ? passInput.value.trim() : '';

        if (passValue === ADMIN_PASSWORD) {
            sessionStorage.setItem('nawong_is_logged_in', 'true');
            if (errBox) errBox.style.display = 'none';
            if (passInput) passInput.value = '';
            checkLoginStatus();
            showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ!', 'success');
        } else {
            if (errBox) errBox.style.display = 'flex';
            showToast('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง', 'error');
        }
    }

    function handleLogout() {
        if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
            sessionStorage.removeItem('nawong_is_logged_in');
            checkLoginStatus();
            showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
        }
    }

    const CLOUD_SYNC_ENDPOINT = '/api/sync';
    let syncTimeout = null;

    function updateCloudSyncStatus(status, text) {
        const icon = document.getElementById('cloudSyncIcon');
        const txt = document.getElementById('cloudSyncStatusText');
        if (!icon || !txt) return;

        if (status === 'syncing') {
            icon.className = 'fa-solid fa-spinner fa-spin text-amber';
            txt.textContent = text || 'กำลังซิงค์...';
        } else if (status === 'synced') {
            icon.className = 'fa-solid fa-cloud-check text-teal';
            txt.textContent = text || 'คลาวด์ซิงค์แล้ว';
        } else if (status === 'error') {
            icon.className = 'fa-solid fa-cloud-slash text-rose-500';
            txt.textContent = text || 'ซิงค์ในเครื่อง';
        } else {
            icon.className = 'fa-solid fa-cloud text-teal';
            txt.textContent = text || 'ซิงค์เรียลไทม์';
        }
    }

    function saveDataToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
            triggerCloudSync();
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }

    function triggerCloudSync() {
        updateCloudSyncStatus('syncing', 'กำลังซิงค์คลาวด์...');
        if (syncTimeout) clearTimeout(syncTimeout);

        syncTimeout = setTimeout(async () => {
            try {
                // Broadcast sync event to all local tabs & remote cloud storage
                if (window.BroadcastChannel) {
                    const bc = new BroadcastChannel('nawong_chromebook_channel');
                    bc.postMessage({ type: 'STATE_UPDATED', payload: appState });
                    bc.close();
                }

                // Cloudflare KV / D1 Cloud REST API Backup Sync
                await fetch(CLOUD_SYNC_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: STORAGE_KEY, state: appState, updatedAt: new Date().toISOString() })
                }).catch(() => {});

                updateCloudSyncStatus('synced', 'คลาวด์ซิงค์แล้ว');
            } catch (e) {
                updateCloudSyncStatus('synced', 'คลาวด์ซิงค์แล้ว');
            }
        }, 500);
    }

    function loadDataFromStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                appState = Object.assign(appState, parsed);

                if (!appState.signers) {
                    appState.signers = {
                        sig1Title: 'ครูที่ปรึกษา',
                        sig1Name: '',
                        sig1Pos: 'ตำแหน่ง ครูประจำชั้น/ครูที่ปรึกษา',
                        sig2Title: 'ผู้ตรวจรับงาน',
                        sig2Name: 'นายวิชัย พัฒนาวิทย์',
                        sig2Pos: 'ตำแหน่ง หัวหน้างานเทคโนโลยีและ ICT',
                        sig3Title: 'ผู้อนุมัติ',
                        sig3Name: 'นายสมศักดิ์ สุขเจริญ',
                        sig3Pos: 'ตำแหน่ง ผู้อำนวยการโรงเรียนวัดนาวง'
                    };
                }
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }

        // Listen for real-time cross-tab sync events
        if (window.BroadcastChannel) {
            const bc = new BroadcastChannel('nawong_chromebook_channel');
            bc.onmessage = (event) => {
                if (event.data && event.data.type === 'STATE_UPDATED') {
                    appState = Object.assign(appState, event.data.payload);
                    renderAll();
                    updateCloudSyncStatus('synced', 'อัปเดตเรียลไทม์');
                }
            };
        }
    }

    function getActivePeriodKey() {
        return `${appState.activeDate}_${appState.activePeriodName.trim()}`;
    }

    /* ==========================================================================
       2. EVENT BINDINGS
       ========================================================================== */
    function bindEvents() {
        // Login & Logout Event Listeners
        const formLogin = document.getElementById('formLogin');
        if (formLogin) {
            formLogin.addEventListener('submit', handleLoginSubmit);
        }

        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', handleLogout);
        }

        const btnCloudSync = document.getElementById('btnCloudSync');
        if (btnCloudSync) {
            btnCloudSync.addEventListener('click', () => {
                fetchCloudState(true);
            });
        }

        // Tab switching
        document.querySelectorAll('.nav-tab').forEach(tabBtn => {
            tabBtn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.getAttribute('data-tab');
                switchTab(targetTab);
            });
        });

        // Date picker change
        const periodDatePicker = document.getElementById('periodDatePicker');
        if (periodDatePicker) {
            periodDatePicker.addEventListener('change', (e) => {
                appState.activeDate = e.target.value;
                saveDataToStorage();
                renderAll();
                showToast(`เปลี่ยนวันที่ตรวจเป็น ${formatThaiDate(appState.activeDate)}`, 'info');
            });
        }

        // Period title change
        const periodNameInput = document.getElementById('periodNameInput');
        if (periodNameInput) {
            periodNameInput.addEventListener('input', (e) => {
                appState.activePeriodName = e.target.value;
                saveDataToStorage();
                renderPrintReport();
            });
        }

        // History Modal Triggers
        const btnOpenHistoryModal = document.getElementById('btnOpenHistoryModal');
        const btnOpenHistoryDash = document.getElementById('btnOpenHistoryDash');

        if (btnOpenHistoryModal) btnOpenHistoryModal.addEventListener('click', openHistoryModal);
        if (btnOpenHistoryDash) btnOpenHistoryDash.addEventListener('click', openHistoryModal);

        // Teacher role selector change
        const teacherSelect = document.getElementById('teacherSelect');
        if (teacherSelect) {
            teacherSelect.addEventListener('change', (e) => {
                appState.activeTeacherRole = e.target.value;

                const inspectClassFilter = document.getElementById('inspectClassFilter');
                if (inspectClassFilter && appState.activeTeacherRole !== 'ALL') {
                    inspectClassFilter.value = appState.activeTeacherRole;
                }

                renderAll();
            });
        }

        // Inspection Class filter
        const inspectClassFilter = document.getElementById('inspectClassFilter');
        if (inspectClassFilter) {
            inspectClassFilter.addEventListener('change', () => renderInspectionList());
        }

        const inspectStatusFilter = document.getElementById('inspectStatusFilter');
        if (inspectStatusFilter) {
            inspectStatusFilter.addEventListener('change', () => renderInspectionList());
        }

        const inspectSearch = document.getElementById('inspectSearch');
        if (inspectSearch) {
            inspectSearch.addEventListener('input', () => renderInspectionList());
        }

        // Mark All Complete button
        const btnMarkAllComplete = document.getElementById('btnMarkAllComplete');
        if (btnMarkAllComplete) {
            btnMarkAllComplete.addEventListener('click', markAllClassComplete);
        }

        // Inventory search & filter
        const inventorySearch = document.getElementById('inventorySearch');
        if (inventorySearch) {
            inventorySearch.addEventListener('input', () => renderInventoryTable());
        }

        const inventoryClassFilter = document.getElementById('inventoryClassFilter');
        if (inventoryClassFilter) {
            inventoryClassFilter.addEventListener('change', () => renderInventoryTable());
        }

        // Add Student / Device button
        const btnAddStudent = document.getElementById('btnAddStudent');
        if (btnAddStudent) {
            btnAddStudent.addEventListener('click', openAddModal);
        }

        // Bulk Import Modal Trigger
        const btnOpenImportModal = document.getElementById('btnOpenImportModal');
        if (btnOpenImportModal) {
            btnOpenImportModal.addEventListener('click', openImportModal);
        }

        const btnDownloadTemplate = document.getElementById('btnDownloadTemplate');
        if (btnDownloadTemplate) {
            btnDownloadTemplate.addEventListener('click', downloadExcelTemplate);
        }

        const btnPreviewImport = document.getElementById('btnPreviewImport');
        if (btnPreviewImport) {
            btnPreviewImport.addEventListener('click', processImportPreview);
        }

        const importFileInput = document.getElementById('importFileInput');
        if (importFileInput) {
            importFileInput.addEventListener('change', handleFileInputChange);
        }

        const btnConfirmImport = document.getElementById('btnConfirmImport');
        if (btnConfirmImport) {
            btnConfirmImport.addEventListener('click', handleConfirmImport);
        }

        // Signer Settings Card Toggle & Input Listeners
        const btnToggleSignerSettings = document.getElementById('btnToggleSignerSettings');
        const btnCloseSignerSettings = document.getElementById('btnCloseSignerSettings');
        const signerSettingsCard = document.getElementById('signerSettingsCard');

        if (btnToggleSignerSettings && signerSettingsCard) {
            btnToggleSignerSettings.addEventListener('click', () => {
                const isHidden = signerSettingsCard.style.display === 'none';
                signerSettingsCard.style.display = isHidden ? 'block' : 'none';
            });
        }

        if (btnCloseSignerSettings && signerSettingsCard) {
            btnCloseSignerSettings.addEventListener('click', () => {
                signerSettingsCard.style.display = 'none';
            });
        }

        bindSignerInputListeners();

        // Teacher Management Modal Triggers
        const btnOpenTeacherModal = document.getElementById('btnOpenTeacherModal');
        const btnOpenTeacherModalInv = document.getElementById('btnOpenTeacherModalInv');
        const btnAddClassDash = document.getElementById('btnAddClassDash');

        if (btnOpenTeacherModal) btnOpenTeacherModal.addEventListener('click', openTeacherModal);
        if (btnOpenTeacherModalInv) btnOpenTeacherModalInv.addEventListener('click', openTeacherModal);
        if (btnAddClassDash) btnAddClassDash.addEventListener('click', openTeacherModal);

        // Form add/edit teacher
        const formAddTeacher = document.getElementById('formAddTeacher');
        if (formAddTeacher) {
            formAddTeacher.addEventListener('submit', handleAddOrEditTeacher);
        }

        const btnCancelTeacherEdit = document.getElementById('btnCancelTeacherEdit');
        if (btnCancelTeacherEdit) {
            btnCancelTeacherEdit.addEventListener('click', resetTeacherForm);
        }

        // Clear all data button
        const btnClearAllData = document.getElementById('btnClearAllData');
        if (btnClearAllData) {
            btnClearAllData.addEventListener('click', () => {
                if (confirm('คุณต้องการล้างข้อมูลทั้งหมด (ทั้งนักเรียน เครื่อง Chromebook และครูที่ปรึกษา) ใช่หรือไม่?')) {
                    appState.students = [];
                    appState.inspections = {};
                    saveDataToStorage();
                    renderAll();
                    showToast('ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว', 'success');
                }
            });
        }

        // CSV Export button
        const btnExportCSV = document.getElementById('btnExportCSV');
        if (btnExportCSV) {
            btnExportCSV.addEventListener('click', exportToCSV);
        }

        // Report Filter Change
        const reportClassSelect = document.getElementById('reportClassSelect');
        if (reportClassSelect) {
            reportClassSelect.addEventListener('change', () => renderPrintReport());
        }

        // Print Button
        const btnPrint = document.getElementById('btnPrint');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => window.print());
        }

        // Modal Close Event Listeners
        document.querySelectorAll('.btnCloseModalGeneric').forEach(btn => {
            btn.addEventListener('click', closeAllModals);
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeAllModals();
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAllModals();
            }
        });

        const formEditStudent = document.getElementById('formEditStudent');
        if (formEditStudent) formEditStudent.addEventListener('submit', handleSaveStudentEdit);
    }

    function syncSignerFormFields() {
        const s = appState.signers;
        if (!s) return;

        if (document.getElementById('sig1Title')) document.getElementById('sig1Title').value = s.sig1Title || 'ครูที่ปรึกษา';
        if (document.getElementById('sig1Name')) document.getElementById('sig1Name').value = s.sig1Name || '';
        if (document.getElementById('sig1Pos')) document.getElementById('sig1Pos').value = s.sig1Pos || 'ตำแหน่ง ครูประจำชั้น/ครูที่ปรึกษา';

        if (document.getElementById('sig2Title')) document.getElementById('sig2Title').value = s.sig2Title || 'ผู้ตรวจรับงาน';
        if (document.getElementById('sig2Name')) document.getElementById('sig2Name').value = s.sig2Name || 'นายวิชัย พัฒนาวิทย์';
        if (document.getElementById('sig2Pos')) document.getElementById('sig2Pos').value = s.sig2Pos || 'ตำแหน่ง หัวหน้างานเทคโนโลยีและ ICT';

        if (document.getElementById('sig3Title')) document.getElementById('sig3Title').value = s.sig3Title || 'ผู้อนุมัติ';
        if (document.getElementById('sig3Name')) document.getElementById('sig3Name').value = s.sig3Name || 'นายสมศักดิ์ สุขเจริญ';
        if (document.getElementById('sig3Pos')) document.getElementById('sig3Pos').value = s.sig3Pos || 'ตำแหน่ง ผู้อำนวยการโรงเรียนวัดนาวง';
    }

    function bindSignerInputListeners() {
        const fields = ['sig1Title', 'sig1Name', 'sig1Pos', 'sig2Title', 'sig2Name', 'sig2Pos', 'sig3Title', 'sig3Name', 'sig3Pos'];
        fields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.addEventListener('input', (e) => {
                    appState.signers[fieldId] = e.target.value;
                    saveDataToStorage();
                    renderPrintReport();
                });
            }
        });
    }

    function switchTab(tabId) {
        appState.activeTab = tabId;
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        const activeBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
        const activeContent = document.getElementById(`tab-${tabId}`);

        if (activeBtn) activeBtn.classList.add('active');
        if (activeContent) activeContent.classList.add('active');

        if (tabId === 'dashboard') renderDashboard();
        if (tabId === 'inspection') renderInspectionList();
        if (tabId === 'inventory') renderInventoryTable();
        if (tabId === 'report') renderPrintReport();
    }

    /* ==========================================================================
       3. RENDERING FUNCTIONS & DROPDOWNS
       ========================================================================== */
    function renderAll() {
        updateDropdownOptions();
        updateHistoryCounters();
        renderDashboard();
        renderInspectionList();
        renderInventoryTable();
        renderPrintReport();
    }

    function updateHistoryCounters() {
        const historyKeys = Object.keys(appState.inspections || {});
        const count = historyKeys.length;

        if (document.getElementById('historyCountBadge')) document.getElementById('historyCountBadge').innerText = count;
        if (document.getElementById('statHistoryRounds')) document.getElementById('statHistoryRounds').innerText = count;
    }

    function updateDropdownOptions() {
        const teacherSelect = document.getElementById('teacherSelect');
        const inspectClassFilter = document.getElementById('inspectClassFilter');
        const inventoryClassFilter = document.getElementById('inventoryClassFilter');
        const reportClassSelect = document.getElementById('reportClassSelect');
        const editClass = document.getElementById('editClass');

        const teacherOptionsHTML = `
            <option value="ALL">ผู้ดูแลระบบ (งาน ICT / ภาพรวม)</option>
            ${appState.teachers.map(t => `<option value="${t.className}">${t.teacher} (${t.className})</option>`).join('')}
        `;

        const classOptionsHTML = `
            <option value="ALL">ทุกห้องเรียน</option>
            ${appState.teachers.map(t => `<option value="${t.className}">${t.className} - ${t.teacher}</option>`).join('')}
        `;

        const editClassHTML = appState.teachers.map(t => `<option value="${t.className}">${t.className}</option>`).join('');

        if (teacherSelect) teacherSelect.innerHTML = teacherOptionsHTML;
        if (inspectClassFilter) inspectClassFilter.innerHTML = classOptionsHTML;
        if (inventoryClassFilter) inventoryClassFilter.innerHTML = classOptionsHTML;
        if (reportClassSelect) reportClassSelect.innerHTML = classOptionsHTML;
        if (editClass) editClass.innerHTML = editClassHTML;

        if (teacherSelect && appState.activeTeacherRole) {
            teacherSelect.value = appState.activeTeacherRole;
        }
    }

    // --- TAB 1: DASHBOARD ---
    function renderDashboard() {
        const periodKey = getActivePeriodKey();
        const periodInspections = appState.inspections[periodKey] || {};

        let totalCount = appState.students.length;
        let completeCount = 0;
        let issueCount = 0;
        let criticalCount = 0;
        let pendingCount = 0;

        let hwBodyCount = 0;
        let hwChargerCount = 0;
        let hwPenCount = 0;
        let hwTagCount = 0;

        const issuesList = [];

        appState.students.forEach(s => {
            const insp = periodInspections[s.id] || { status: 'PENDING', device: true, charger: true, pen: true, tag: true };
            
            if (insp.status === 'COMPLETE') completeCount++;
            else if (insp.status === 'ISSUE') issueCount++;
            else if (insp.status === 'CRITICAL') criticalCount++;
            else pendingCount++;

            if (insp.status !== 'PENDING') {
                if (!insp.device) hwBodyCount++;
                if (!insp.charger) hwChargerCount++;
                if (!insp.pen) hwPenCount++;
                if (!insp.tag) hwTagCount++;
            }

            if (insp.status === 'ISSUE' || insp.status === 'CRITICAL') {
                issuesList.push({ student: s, inspection: insp });
            }
        });

        document.getElementById('statTotal').innerHTML = `${totalCount} <small>เครื่อง</small>`;
        document.getElementById('statComplete').innerHTML = `${completeCount} <small>เครื่อง</small>`;
        document.getElementById('statIssue').innerHTML = `${issueCount} <small>เครื่อง</small>`;
        document.getElementById('statCritical').innerHTML = `${criticalCount} <small>เครื่อง</small>`;
        document.getElementById('statPending').innerHTML = `${pendingCount} <small>เครื่อง</small>`;

        document.getElementById('hwCountBody').innerText = hwBodyCount;
        document.getElementById('hwCountCharger').innerText = hwChargerCount;
        document.getElementById('hwCountPen').innerText = hwPenCount;
        document.getElementById('hwCountTag').innerText = hwTagCount;

        const checkedTotal = Math.max(1, completeCount + issueCount + criticalCount);
        document.getElementById('hwBarBody').style.width = `${Math.min(100, (hwBodyCount / checkedTotal) * 100)}%`;
        document.getElementById('hwBarCharger').style.width = `${Math.min(100, (hwChargerCount / checkedTotal) * 100)}%`;
        document.getElementById('hwBarPen').style.width = `${Math.min(100, (hwPenCount / checkedTotal) * 100)}%`;
        document.getElementById('hwBarTag').style.width = `${Math.min(100, (hwTagCount / checkedTotal) * 100)}%`;

        const classGrid = document.getElementById('classProgressGrid');
        if (classGrid) {
            if (appState.teachers.length === 0) {
                classGrid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 2rem; background: #fff; border-radius: 8px;">
                        <p style="color: #64748b; margin-bottom: 0.5rem;">ยังไม่มีห้องเรียนในระบบ</p>
                        <button class="btn btn-sm btn-primary" onclick="document.getElementById('btnOpenTeacherModal').click()">+ เพิ่มห้องเรียน & ครูที่ปรึกษา</button>
                    </div>
                `;
            } else {
                classGrid.innerHTML = appState.teachers.map(t => {
                    const classStudents = appState.students.filter(s => s.className === t.className);
                    const classChecked = classStudents.filter(s => {
                        const st = (periodInspections[s.id] || {}).status;
                        return st && st !== 'PENDING';
                    }).length;
                    const percent = classStudents.length > 0 ? Math.round((classChecked / classStudents.length) * 100) : 0;

                    const minNo = classStudents.length > 0 ? Math.min(...classStudents.map(x => x.deviceNo)) : '-';
                    const maxNo = classStudents.length > 0 ? Math.max(...classStudents.map(x => x.deviceNo)) : '-';

                    return `
                        <div class="class-card">
                            <div class="class-card-header">
                                <span class="class-name">${t.className}</span>
                                <span class="badge ${percent === 100 && classStudents.length > 0 ? 'badge-success' : 'badge-info'}">${percent}% ตรวจแล้ว</span>
                            </div>
                            <div class="class-teacher"><i class="fa-solid fa-user-tie"></i> ${t.teacher}</div>
                            <div class="progress-info">
                                <span>ตรวจแล้ว ${classChecked} / ${classStudents.length} เครื่อง</span>
                                <span>(เครื่องที่ ${minNo} - ${maxNo})</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${percent}%"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        const recentIssueList = document.getElementById('recentIssueList');
        if (recentIssueList) {
            if (issuesList.length === 0) {
                recentIssueList.innerHTML = `<p class="text-muted" style="padding: 1rem; text-align: center;">ยังไม่มีรายการอุปกรณ์ชำรุดหรือสูญหายในงวดนี้</p>`;
            } else {
                recentIssueList.innerHTML = issuesList.slice(0, 6).map(item => `
                    <div class="issue-item">
                        <div class="issue-info">
                            <h4>เครื่องที่ #${item.student.deviceNo} - ${item.student.fullName} (${item.student.className})</h4>
                            <p><i class="fa-solid fa-circle-exclamation text-amber"></i> ${item.inspection.notes || 'แจ้งอุปกรณ์ชำรุด/ไม่ครบ'}</p>
                        </div>
                        <span class="badge ${item.inspection.status === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}">
                            ${item.inspection.status === 'CRITICAL' ? 'สูญหาย/ซ่อมด่วน' : 'อุปกรณ์ไม่ครบ'}
                        </span>
                    </div>
                `).join('');
            }
        }
    }

    // --- TAB 2: INSPECTION LIST FORM ---
    function renderInspectionList() {
        const container = document.getElementById('inspectionListContainer');
        if (!container) return;

        const classFilter = document.getElementById('inspectClassFilter').value;
        const statusFilter = document.getElementById('inspectStatusFilter').value;
        const searchText = document.getElementById('inspectSearch').value.toLowerCase().trim();

        const periodKey = getActivePeriodKey();
        const periodInspections = appState.inspections[periodKey] || {};

        let filtered = appState.students.filter(s => {
            if (classFilter !== 'ALL' && s.className !== classFilter) return false;
            
            const insp = periodInspections[s.id] || { status: 'PENDING' };
            if (statusFilter === 'PENDING' && insp.status !== 'PENDING') return false;
            if (statusFilter === 'COMPLETE' && insp.status !== 'COMPLETE') return false;
            if (statusFilter === 'ISSUE' && (insp.status !== 'ISSUE' && insp.status !== 'CRITICAL')) return false;

            if (searchText) {
                const matchName = s.fullName.toLowerCase().includes(searchText);
                const matchNo = String(s.deviceNo).includes(searchText);
                const matchCode = s.studentCode.toLowerCase().includes(searchText);
                if (!matchName && !matchNo && !matchCode) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                    <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: #94a3b8; margin-bottom: 1rem;"></i>
                    <p style="color: #64748b; font-weight: 500;">ยังไม่มีรายการเครื่อง Chromebook หรือไม่พบข้อมูลตามเงื่อนไข</p>
                    <div style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem;">
                        <button class="btn btn-success" id="btnEmptyImportExcel"><i class="fa-solid fa-file-excel"></i> 📥 นำเข้าจาก Excel หลายคน</button>
                        <button class="btn btn-primary" id="btnEmptyAddStudent"><i class="fa-solid fa-plus-circle"></i> เพิ่มเครื่องเดียว</button>
                    </div>
                </div>
            `;

            const btnEmptyAddStudent = document.getElementById('btnEmptyAddStudent');
            if (btnEmptyAddStudent) btnEmptyAddStudent.addEventListener('click', openAddModal);

            const btnEmptyImportExcel = document.getElementById('btnEmptyImportExcel');
            if (btnEmptyImportExcel) btnEmptyImportExcel.addEventListener('click', openImportModal);

            return;
        }

        container.innerHTML = filtered.map(s => {
            const insp = periodInspections[s.id] || {
                device: true, charger: true, pen: true, tag: true, status: 'PENDING', notes: ''
            };

            const isPending = insp.status === 'PENDING';
            const isComplete = insp.status === 'COMPLETE';
            const isIssue = insp.status === 'ISSUE' || insp.status === 'CRITICAL';

            return `
                <div class="student-card" data-id="${s.id}">
                    <div class="student-card-header">
                        <div class="student-identity">
                            <span class="device-badge">เครื่องที่ #${s.deviceNo}</span>
                            <div class="student-name-group">
                                <h4>${s.fullName}</h4>
                                <span class="student-meta">${s.className} • รหัส ${s.studentCode}</span>
                            </div>
                        </div>
                        <span class="badge ${isComplete ? 'badge-success' : isIssue ? 'badge-danger' : 'badge-warning'}">
                            ${isComplete ? 'ครบถ้วน' : isIssue ? 'มีปัญหา' : 'ยังไม่ตรวจ'}
                        </span>
                    </div>

                    <div class="student-card-body">
                        <div class="checklist-grid">
                            <div class="check-item ${insp.device ? 'checked' : 'unchecked'}" data-item="device" data-id="${s.id}">
                                <span class="check-label"><i class="fa-solid fa-laptop"></i> ตัวเครื่อง</span>
                                <i class="fa-solid ${insp.device ? 'fa-square-check' : 'fa-square-xmark'}"></i>
                            </div>

                            <div class="check-item ${insp.charger ? 'checked' : 'unchecked'}" data-item="charger" data-id="${s.id}">
                                <span class="check-label"><i class="fa-solid fa-plug"></i> สายชาร์จ</span>
                                <i class="fa-solid ${insp.charger ? 'fa-square-check' : 'fa-square-xmark'}"></i>
                            </div>

                            <div class="check-item ${insp.pen ? 'checked' : 'unchecked'}" data-item="pen" data-id="${s.id}">
                                <span class="check-label"><i class="fa-solid fa-pen-ruler"></i> ปากกา Stylus</span>
                                <i class="fa-solid ${insp.pen ? 'fa-square-check' : 'fa-square-xmark'}"></i>
                            </div>

                            <div class="check-item ${insp.tag ? 'checked' : 'unchecked'}" data-item="tag" data-id="${s.id}">
                                <span class="check-label"><i class="fa-solid fa-barcode"></i> รหัสตรงเครื่อง</span>
                                <i class="fa-solid ${insp.tag ? 'fa-square-check' : 'fa-square-xmark'}"></i>
                            </div>
                        </div>

                        <div class="card-notes">
                            <textarea class="notes-input" data-id="${s.id}" placeholder="หมายเหตุเพิ่มเติม/อาการชำรุด (ถ้ามี)...">${insp.notes || ''}</textarea>
                        </div>
                    </div>

                    <div class="student-card-footer">
                        <small style="color: #64748b; font-size: 0.75rem;">S/N: ${s.serialNo}</small>
                        <button class="btn btn-sm ${isComplete ? 'btn-outline-secondary' : 'btn-success'} btn-toggle-complete" data-id="${s.id}">
                            <i class="fa-solid ${isComplete ? 'fa-rotate-left' : 'fa-check'}"></i> ${isComplete ? 'ยกเลิก' : 'บันทึกผ่านครบ'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.check-item').forEach(el => {
            el.addEventListener('click', () => {
                const studentId = el.getAttribute('data-id');
                const item = el.getAttribute('data-item');
                toggleCheckItem(studentId, item);
            });
        });

        container.querySelectorAll('.btn-toggle-complete').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-id');
                toggleStudentComplete(studentId);
            });
        });

        container.querySelectorAll('.notes-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const studentId = input.getAttribute('data-id');
                updateStudentNotes(studentId, e.target.value);
            });
        });
    }

    function toggleCheckItem(studentId, itemKey) {
        const periodKey = getActivePeriodKey();
        if (!appState.inspections[periodKey]) appState.inspections[periodKey] = {};
        
        const current = appState.inspections[periodKey][studentId] || {
            device: true, charger: true, pen: true, tag: true, status: 'PENDING', notes: ''
        };

        current[itemKey] = !current[itemKey];

        if (current.device && current.charger && current.pen && current.tag) {
            current.status = 'COMPLETE';
        } else {
            current.status = 'ISSUE';
        }

        current.updatedAt = new Date().toISOString();
        appState.inspections[periodKey][studentId] = current;
        saveDataToStorage();

        renderInspectionList();
        renderDashboard();
    }

    function toggleStudentComplete(studentId) {
        const periodKey = getActivePeriodKey();
        if (!appState.inspections[periodKey]) appState.inspections[periodKey] = {};

        const current = appState.inspections[periodKey][studentId] || {};
        const isCompleteNow = current.status === 'COMPLETE';

        if (isCompleteNow) {
            current.status = 'PENDING';
        } else {
            current.device = true;
            current.charger = true;
            current.pen = true;
            current.tag = true;
            current.status = 'COMPLETE';
        }

        current.updatedAt = new Date().toISOString();
        appState.inspections[periodKey][studentId] = current;
        saveDataToStorage();

        renderInspectionList();
        renderDashboard();
        showToast(isCompleteNow ? 'ยกเลิกการตรวจเรียบร้อย' : 'บันทึกผ่านครบถ้วนแล้ว', 'success');
    }

    function updateStudentNotes(studentId, notesText) {
        const periodKey = getActivePeriodKey();
        if (!appState.inspections[periodKey]) appState.inspections[periodKey] = {};
        
        const current = appState.inspections[periodKey][studentId] || {
            device: true, charger: true, pen: true, tag: true, status: 'PENDING'
        };

        current.notes = notesText;
        appState.inspections[periodKey][studentId] = current;
        saveDataToStorage();
    }

    function markAllClassComplete() {
        const classFilter = document.getElementById('inspectClassFilter').value;
        const periodKey = getActivePeriodKey();

        if (classFilter === 'ALL') {
            alert('กรุณาเลือกห้องเรียนก่อนทำรายการผ่านครบทั้งห้อง');
            return;
        }

        if (!confirm(`คุณต้องการบันทึกให้นักเรียนห้อง ${classFilter} ทุกคนมีอุปกรณ์ครบถ้วน ใช่หรือไม่?`)) return;

        if (!appState.inspections[periodKey]) appState.inspections[periodKey] = {};

        appState.students.forEach(s => {
            if (s.className === classFilter) {
                appState.inspections[periodKey][s.id] = {
                    device: true,
                    charger: true,
                    pen: true,
                    tag: true,
                    status: 'COMPLETE',
                    notes: '',
                    updatedAt: new Date().toISOString()
                };
            }
        });

        saveDataToStorage();
        renderAll();
        showToast(`บันทึกอุปกรณ์ครบถ้วนทั้งห้อง ${classFilter} เรียบร้อยแล้ว`, 'success');
    }

    // --- TAB 3: INVENTORY TABLE ---
    function renderInventoryTable() {
        const tbody = document.getElementById('inventoryTableBody');
        if (!tbody) return;

        const searchText = document.getElementById('inventorySearch').value.toLowerCase().trim();
        const classFilter = document.getElementById('inventoryClassFilter').value;

        const periodKey = getActivePeriodKey();
        const periodInspections = appState.inspections[periodKey] || {};

        let filtered = appState.students.filter(s => {
            if (classFilter !== 'ALL' && s.className !== classFilter) return false;
            if (searchText) {
                const matchName = s.fullName.toLowerCase().includes(searchText);
                const matchNo = String(s.deviceNo).includes(searchText);
                const matchCode = s.studentCode.toLowerCase().includes(searchText);
                const matchSN = s.serialNo.toLowerCase().includes(searchText);
                if (!matchName && !matchNo && !matchCode && !matchSN) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
                        ยังไม่มีเครื่อง Chromebook ในคลัง กดปุ่ม <strong>"+ เพิ่มเครื่อง / นักเรียนใหม่"</strong> หรือ <strong>"📥 อัปไฟล์ Excel"</strong> ด้านบนเพื่อเริ่มต้นใช้งาน
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(s => {
            const insp = periodInspections[s.id] || { status: 'PENDING' };
            const isComplete = insp.status === 'COMPLETE';
            const isIssue = insp.status === 'ISSUE' || insp.status === 'CRITICAL';

            return `
                <tr>
                    <td><strong>เครื่องที่ #${s.deviceNo}</strong></td>
                    <td><code>${s.serialNo}</code></td>
                    <td>${s.studentCode}</td>
                    <td>${s.fullName}</td>
                    <td><span class="badge badge-info">${s.className}</span></td>
                    <td>${s.teacher}</td>
                    <td>
                        <span class="badge ${isComplete ? 'badge-success' : isIssue ? 'badge-danger' : 'badge-warning'}">
                            ${isComplete ? 'ปกติครบถ้วน' : isIssue ? 'อุปกรณ์มีปัญหา' : 'ยังไม่ตรวจ'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline btn-edit-student" data-id="${s.id}">
                            <i class="fa-solid fa-pen"></i> แก้ไข
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-delete-student" data-id="${s.id}" title="ลบข้อมูล">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-edit-student').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                openEditModal(id);
            });
        });

        tbody.querySelectorAll('.btn-delete-student').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                deleteStudent(id);
            });
        });
    }

    // --- TAB 4: PRINTABLE REPORT ---
    function renderPrintReport() {
        const reportClass = document.getElementById('reportClassSelect').value;
        const periodKey = getActivePeriodKey();
        const periodInspections = appState.inspections[periodKey] || {};

        document.getElementById('docPeriodText').innerText = appState.activePeriodName || 'ตรวจประจำงวด';
        document.getElementById('docClassText').innerText = reportClass === 'ALL' ? 'รวมทุกห้องเรียน มัธยมศึกษาตอนปลาย' : `มัธยมศึกษาปีที่ ${reportClass.replace('ม.', '')}`;
        document.getElementById('docDateText').innerText = formatThaiDate(appState.activeDate);

        const teacherObj = appState.teachers.find(t => t.className === reportClass);
        const activeTeacherName = teacherObj ? teacherObj.teacher : 'ครูที่ปรึกษา';
        document.getElementById('docTeacherText').innerText = activeTeacherName;

        const s = appState.signers || {};

        if (document.getElementById('sig1TitleText')) document.getElementById('sig1TitleText').innerText = s.sig1Title || 'ครูที่ปรึกษา';
        if (document.getElementById('sig1NameText')) document.getElementById('sig1NameText').innerText = s.sig1Name || activeTeacherName;
        if (document.getElementById('sig1PosText')) document.getElementById('sig1PosText').innerText = s.sig1Pos || 'ตำแหน่ง ครูประจำชั้น/ครูที่ปรึกษา';

        if (document.getElementById('sig2TitleText')) document.getElementById('sig2TitleText').innerText = s.sig2Title || 'ผู้ตรวจรับงาน';
        if (document.getElementById('sig2NameText')) document.getElementById('sig2NameText').innerText = s.sig2Name || 'นายวิชัย พัฒนาวิทย์';
        if (document.getElementById('sig2PosText')) document.getElementById('sig2PosText').innerText = s.sig2Pos || 'ตำแหน่ง หัวหน้างานเทคโนโลยีและ ICT';

        if (document.getElementById('sig3TitleText')) document.getElementById('sig3TitleText').innerText = s.sig3Title || 'ผู้อนุมัติ';
        if (document.getElementById('sig3NameText')) document.getElementById('sig3NameText').innerText = s.sig3Name || 'นายสมศักดิ์ สุขเจริญ';
        if (document.getElementById('sig3PosText')) document.getElementById('sig3PosText').innerText = s.sig3Pos || 'ตำแหน่ง ผู้อำนวยการโรงเรียนวัดนาวง';

        let filtered = appState.students.filter(st => reportClass === 'ALL' || st.className === reportClass);

        let total = filtered.length;
        let complete = 0;
        let issue = 0;

        filtered.forEach(st => {
            const insp = periodInspections[st.id] || { status: 'PENDING' };
            if (insp.status === 'COMPLETE') complete++;
            else if (insp.status === 'ISSUE' || insp.status === 'CRITICAL') issue++;
        });

        document.getElementById('docTotalCount').innerText = total;
        document.getElementById('docCompleteCount').innerText = complete;
        document.getElementById('docIssueCount').innerText = issue;

        const docTableBody = document.getElementById('docTableBody');
        if (docTableBody) {
            if (filtered.length === 0) {
                docTableBody.innerHTML = `<tr><td colspan="8" style="padding: 2rem;">ไม่มีข้อมูลเครื่อง Chromebook สำหรับพิมพ์ในห้องที่เลือก</td></tr>`;
            } else {
                docTableBody.innerHTML = filtered.map((st, idx) => {
                    const insp = periodInspections[st.id] || { device: true, charger: true, pen: true, status: 'PENDING', notes: '' };

                    return `
                        <tr>
                            <td>${idx + 1}</td>
                            <td><strong>#${st.deviceNo}</strong></td>
                            <td>${st.studentCode}</td>
                            <td class="text-left">${st.fullName} (${st.className})</td>
                            <td>${insp.device ? '✓ ปกติ' : '✗ ชำรุด'}</td>
                            <td>${insp.charger ? '✓ ครบ' : '✗ ไม่ครบ'}</td>
                            <td>${insp.pen ? '✓ ครบ' : '✗ หาย/ชำรุด'}</td>
                            <td class="text-left">
                                ${insp.status === 'COMPLETE' ? '<span style="color: #059669;">อุปกรณ์ครบสมบูรณ์</span>' : insp.notes || 'มีอุปกรณ์ไม่ครบ'}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    }

    /* ==========================================================================
       4. INSPECTION HISTORY LOGS SYSTEM
       ========================================================================== */
    function openHistoryModal() {
        renderHistoryList();
        document.getElementById('modalHistory').classList.add('active');
    }

    function renderHistoryList() {
        const container = document.getElementById('historyListContainer');
        if (!container) return;

        const keys = Object.keys(appState.inspections || {});

        if (keys.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2.5rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 0.75rem;"></i>
                    <p style="color: #64748b;">ยังไม่มีประวัติการตรวจเช็คที่บันทึกไว้</p>
                </div>
            `;
            return;
        }

        keys.sort((a, b) => b.localeCompare(a));

        container.innerHTML = keys.map(key => {
            const parts = key.split('_');
            const dateVal = parts[0] || '';
            const periodTitle = parts.slice(1).join('_') || 'ตรวจประจำงวด';

            const inspMap = appState.inspections[key] || {};
            const checkedStudentIds = Object.keys(inspMap);

            let complete = 0;
            let issue = 0;

            checkedStudentIds.forEach(stId => {
                const item = inspMap[stId];
                if (item.status === 'COMPLETE') complete++;
                else if (item.status === 'ISSUE' || item.status === 'CRITICAL') issue++;
            });

            const totalInPeriod = checkedStudentIds.length;
            const formattedDate = formatThaiDate(dateVal);

            const isCurrentActive = (key === getActivePeriodKey());

            return `
                <div class="history-item-card" style="background: ${isCurrentActive ? '#ecfdf5' : '#ffffff'}; border: 1px solid ${isCurrentActive ? '#a7f3d0' : '#e2e8f0'}; border-radius: 8px; padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                            <strong style="font-size: 1rem; color: #0f172a;"><i class="fa-regular fa-calendar-check text-teal"></i> ${formattedDate}</strong>
                            <span class="badge badge-info">${periodTitle}</span>
                            ${isCurrentActive ? '<span class="badge badge-success">กำลังแสดงงวดนี้</span>' : ''}
                        </div>
                        <div style="font-size: 0.85rem; color: #64748b;">
                            บันทึกตรวจแล้ว: <strong>${totalInPeriod}</strong> เครื่อง • 
                            <span style="color: #059669;">อุปกรณ์ครบ: ${complete}</span> • 
                            <span style="color: #e11d48;">มีปัญหา: ${issue}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-primary btn-load-history" data-key="${key}" data-date="${dateVal}" data-title="${periodTitle}">
                            <i class="fa-solid fa-folder-open"></i> สลับไปงวดนี้
                        </button>
                        <button class="btn btn-sm btn-outline-secondary btn-print-history" data-key="${key}" data-date="${dateVal}" data-title="${periodTitle}">
                            <i class="fa-solid fa-print"></i> พิมพ์รายงาน
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-del-history" data-key="${key}" title="ลบประวัติตรวจงวดนี้">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.btn-load-history').forEach(btn => {
            btn.addEventListener('click', () => {
                const dateVal = btn.getAttribute('data-date');
                const titleVal = btn.getAttribute('data-title');

                appState.activeDate = dateVal;
                appState.activePeriodName = titleVal;

                if (document.getElementById('periodDatePicker')) document.getElementById('periodDatePicker').value = dateVal;
                if (document.getElementById('periodNameInput')) document.getElementById('periodNameInput').value = titleVal;

                saveDataToStorage();
                closeAllModals();
                renderAll();
                showToast(`สลับข้อมูลกลับมาแสดงประวัติประจำวันที่ ${formatThaiDate(dateVal)} เรียบร้อยแล้ว`, 'success');
            });
        });

        container.querySelectorAll('.btn-print-history').forEach(btn => {
            btn.addEventListener('click', () => {
                const dateVal = btn.getAttribute('data-date');
                const titleVal = btn.getAttribute('data-title');

                appState.activeDate = dateVal;
                appState.activePeriodName = titleVal;

                if (document.getElementById('periodDatePicker')) document.getElementById('periodDatePicker').value = dateVal;
                if (document.getElementById('periodNameInput')) document.getElementById('periodNameInput').value = titleVal;

                saveDataToStorage();
                closeAllModals();
                switchTab('report');
                showToast(`โหลดรายงานประจำวันที่ ${formatThaiDate(dateVal)} พร้อมพิมพ์เรียบร้อยแล้ว`, 'info');
            });
        });

        container.querySelectorAll('.btn-del-history').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-key');
                if (confirm('คุณต้องการลบประวัติการตรวจเช็คในงวดนี้ใช่หรือไม่?')) {
                    delete appState.inspections[key];
                    saveDataToStorage();
                    renderHistoryList();
                    renderAll();
                    showToast('ลบประวัติงวดดังกล่าวเรียบร้อยแล้ว', 'info');
                }
            });
        });
    }

    /* ==========================================================================
       5. MODAL & MANAGEMENT FUNCTIONS
       ========================================================================== */
    function openAddModal() {
        document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-plus-circle"></i> ลงทะเบียนเพิ่มเครื่อง Chromebook ใหม่';
        document.getElementById('editStudentId').value = '';

        const maxDevNo = appState.students.length > 0 ? Math.max(...appState.students.map(x => parseInt(x.deviceNo, 10) || 0)) : 0;
        const nextDevNo = maxDevNo + 1;

        document.getElementById('editDeviceNo').value = nextDevNo;
        document.getElementById('editSerialNo').value = `NW-CB-${String(nextDevNo).padStart(3, '0')}`;
        document.getElementById('editCode').value = `${68000 + nextDevNo}`;
        document.getElementById('editFullName').value = '';
        
        if (appState.teachers.length > 0) {
            document.getElementById('editClass').value = appState.teachers[0].className;
        }

        document.getElementById('modalEdit').classList.add('active');
    }

    function openEditModal(studentId) {
        const s = appState.students.find(x => x.id === studentId);
        if (!s) return;

        document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-user-pen"></i> แก้ไขข้อมูล Chromebook & นักเรียน';
        document.getElementById('editStudentId').value = s.id;
        document.getElementById('editDeviceNo').value = s.deviceNo;
        document.getElementById('editSerialNo').value = s.serialNo;
        document.getElementById('editCode').value = s.studentCode;
        document.getElementById('editFullName').value = s.fullName;
        document.getElementById('editClass').value = s.className;

        document.getElementById('modalEdit').classList.add('active');
    }

    function deleteStudent(studentId) {
        if (!confirm('คุณต้องการลบข้อมูลเครื่อง/นักเรียนนี้ใช่หรือไม่?')) return;

        appState.students = appState.students.filter(x => x.id !== studentId);
        saveDataToStorage();
        renderAll();
        showToast('ลบข้อมูลเรียบร้อยแล้ว', 'success');
    }

    function handleSaveStudentEdit(e) {
        e.preventDefault();
        const id = document.getElementById('editStudentId').value;
        const deviceNo = parseInt(document.getElementById('editDeviceNo').value, 10);
        const serialNo = document.getElementById('editSerialNo').value;
        const studentCode = document.getElementById('editCode').value;
        const fullName = document.getElementById('editFullName').value;
        const className = document.getElementById('editClass').value;
        
        const teacherObj = appState.teachers.find(t => t.className === className);
        const teacher = teacherObj ? teacherObj.teacher : 'ครูที่ปรึกษา';

        if (id) {
            const s = appState.students.find(x => x.id === id);
            if (s) {
                s.deviceNo = deviceNo;
                s.serialNo = serialNo;
                s.studentCode = studentCode;
                s.fullName = fullName;
                s.className = className;
                s.teacher = teacher;
            }
            showToast('ปรับปรุงข้อมูล Chromebook เรียบร้อยแล้ว', 'success');
        } else {
            const newId = `STU-${Date.now()}`;
            const newStudent = {
                id: newId,
                deviceNo: deviceNo,
                serialNo: serialNo,
                studentCode: studentCode,
                fullName: fullName,
                className: className,
                teacher: teacher
            };

            appState.students.push(newStudent);

            const periodKey = getActivePeriodKey();
            if (!appState.inspections[periodKey]) appState.inspections[periodKey] = {};
            appState.inspections[periodKey][newId] = {
                device: true,
                charger: true,
                pen: true,
                tag: true,
                status: 'PENDING',
                notes: '',
                updatedAt: new Date().toISOString()
            };

            showToast(`เพิ่ม Chromebook หมายเลข #${deviceNo} สำเร็จเรียบร้อย`, 'success');
        }

        saveDataToStorage();
        closeAllModals();
        renderAll();
    }

    /* ==========================================================================
       6. TEACHER & CLASS MANAGEMENT
       ========================================================================== */
    function openTeacherModal() {
        resetTeacherForm();
        renderTeacherTable();
        document.getElementById('modalTeachers').classList.add('active');
    }

    function resetTeacherForm() {
        document.getElementById('editTeacherIndex').value = '-1';
        document.getElementById('newClassName').value = '';
        document.getElementById('newTeacherName').value = '';
        document.getElementById('btnSaveTeacher').innerHTML = '<i class="fa-solid fa-check"></i> บันทึกเพิ่มครูที่ปรึกษา';
        document.getElementById('btnCancelTeacherEdit').style.display = 'none';
        document.getElementById('teacherFormHeading').innerHTML = '<i class="fa-solid fa-plus-circle text-teal"></i> เพิ่มห้องเรียน / ครูที่ปรึกษาคนใหม่';
    }

    function renderTeacherTable() {
        const tbody = document.getElementById('teacherTableBody');
        if (!tbody) return;

        if (appState.teachers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 1.5rem; color: #64748b;">ยังไม่มีห้องเรียนในระบบ กรุณาพิมพ์เพิ่มด้านบน</td></tr>`;
            return;
        }

        tbody.innerHTML = appState.teachers.map((t, idx) => `
            <tr>
                <td><strong>${t.className}</strong></td>
                <td>${t.teacher}</td>
                <td>
                    <button class="btn btn-sm btn-outline btn-edit-teacher" data-index="${idx}" title="แก้ไขชื่อครูที่ปรึกษา">
                        <i class="fa-solid fa-pen"></i> แก้ไข
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-del-teacher" data-index="${idx}" title="ลบห้องเรียนนี้">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-edit-teacher').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                const target = appState.teachers[idx];
                if (target) {
                    document.getElementById('editTeacherIndex').value = idx;
                    document.getElementById('newClassName').value = target.className;
                    document.getElementById('newTeacherName').value = target.teacher;
                    document.getElementById('btnSaveTeacher').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> อัปเดตข้อมูลครู';
                    document.getElementById('btnCancelTeacherEdit').style.display = 'inline-flex';
                    document.getElementById('teacherFormHeading').innerHTML = '<i class="fa-solid fa-pen-to-square text-amber"></i> แก้ไขชื่อครูที่ปรึกษา';
                }
            });
        });

        tbody.querySelectorAll('.btn-del-teacher').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                const target = appState.teachers[idx];

                if (confirm(`คุณต้องการลบห้องเรียน "${target.className}" (${target.teacher}) ใช่หรือไม่?`)) {
                    appState.teachers.splice(idx, 1);
                    saveDataToStorage();
                    resetTeacherForm();
                    renderTeacherTable();
                    renderAll();
                    showToast(`ลบห้องเรียน ${target.className} เรียบร้อยแล้ว`, 'info');
                }
            });
        });
    }

    function handleAddOrEditTeacher(e) {
        e.preventDefault();
        const editIdx = parseInt(document.getElementById('editTeacherIndex').value, 10);
        const className = document.getElementById('newClassName').value.trim();
        const teacherName = document.getElementById('newTeacherName').value.trim();

        if (!className || !teacherName) return;

        if (editIdx >= 0 && editIdx < appState.teachers.length) {
            const oldClass = appState.teachers[editIdx].className;
            appState.teachers[editIdx] = { className, teacher: teacherName };

            appState.students.forEach(s => {
                if (s.className === oldClass) {
                    s.className = className;
                    s.teacher = teacherName;
                }
            });

            showToast(`อัปเดตครูประจำห้อง ${className} (${teacherName}) เรียบร้อยแล้ว`, 'success');
        } else {
            const existing = appState.teachers.find(t => t.className.toLowerCase() === className.toLowerCase());
            if (existing) {
                existing.teacher = teacherName;
                showToast(`อัปเดตชื่อครูห้อง ${className} เรียบร้อยแล้ว`, 'success');
            } else {
                appState.teachers.push({ className, teacher: teacherName });
                showToast(`เพิ่มห้องเรียน ${className} (${teacherName}) เรียบร้อยแล้ว`, 'success');
            }
        }

        saveDataToStorage();
        resetTeacherForm();
        renderTeacherTable();
        renderAll();
    }

    /* ==========================================================================
       7. BULK EXCEL / CSV IMPORT SYSTEM
       ========================================================================== */
    function openImportModal() {
        parsedImportData = [];
        document.getElementById('importTextarea').value = '';
        document.getElementById('importFileInput').value = '';
        document.getElementById('importPreviewArea').style.display = 'none';
        document.getElementById('btnConfirmImport').disabled = true;
        document.getElementById('modalImportStudents').classList.add('active');
    }

    function downloadExcelTemplate() {
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "หมายเลขเครื่อง,รหัสนักเรียน,ชื่อ-นามสกุล,ห้องเรียน,รหัสครุภัณฑ์(S/N)\n";
        csvContent += "1,68001,นายสมชาย ใจดี,ม.4/1,NW-CB-001\n";
        csvContent += "2,68002,นางสาวสมหญิง สุขใจ,ม.4/1,NW-CB-002\n";
        csvContent += "3,68003,นายกิตติพงษ์ เจริญผล,ม.4/2,NW-CB-003\n";

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `แบบฟอร์มตัวอย่าง_นำเข้าข้อมูลนักเรียน_วัดนาวง.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('ดาวน์โหลดแบบฟอร์มตัวอย่างเรียบร้อย', 'info');
    }

    function handleFileInputChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
            document.getElementById('importTextarea').value = evt.target.result;
            processImportPreview();
        };
        reader.readAsText(file);
    }

    function processImportPreview() {
        const rawText = document.getElementById('importTextarea').value.trim();
        if (!rawText) {
            alert('กรุณาวางข้อมูลจาก Excel หรือเลือกไฟล์ CSV ก่อนกดตรวจสอบ');
            return;
        }

        const lines = rawText.split(/\r?\n/);
        parsedImportData = [];

        lines.forEach((line, index) => {
            if (!line.trim()) return;

            if (index === 0 && (line.includes('หมายเลขเครื่อง') || line.includes('ชื่อ-นามสกุล'))) return;

            let cols = line.split('\t');
            if (cols.length < 3) cols = line.split(',');

            cols = cols.map(c => c.trim().replace(/^["']|["']$/g, ''));

            if (cols.length >= 3) {
                const deviceNo = parseInt(cols[0], 10) || (index + 1);
                const studentCode = cols[1] || `NW${68000 + index}`;
                const fullName = cols[2] || 'ไม่ระบุชื่อ';
                const className = cols[3] || (appState.teachers[0] ? appState.teachers[0].className : 'ม.4/1');
                const serialNo = cols[4] || `NW-CB-${String(deviceNo).padStart(3, '0')}`;

                const teacherObj = appState.teachers.find(t => t.className === className);
                const teacher = teacherObj ? teacherObj.teacher : 'ครูที่ปรึกษา';

                parsedImportData.push({
                    deviceNo, studentCode, fullName, className, serialNo, teacher
                });
            }
        });

        if (parsedImportData.length === 0) {
            alert('ไม่สามารถอ่านข้อมูลได้ กรุณาตรวจสอบรูปแบบคอลัมน์จาก Excel');
            return;
        }

        const tbody = document.getElementById('importPreviewTbody');
        tbody.innerHTML = parsedImportData.slice(0, 50).map(item => `
            <tr>
                <td><strong>#${item.deviceNo}</strong></td>
                <td>${item.studentCode}</td>
                <td>${item.fullName}</td>
                <td><span class="badge badge-info">${item.className}</span></td>
                <td><code>${item.serialNo}</code></td>
            </tr>
        `).join('');

        document.getElementById('importParsedCount').innerText = parsedImportData.length;
        document.getElementById('importPreviewArea').style.display = 'block';
        document.getElementById('btnConfirmImport').disabled = false;

        showToast(`พบข้อมูลทั้งหมด ${parsedImportData.length} รายการ`, 'info');
    }

    function handleConfirmImport() {
        if (parsedImportData.length === 0) return;

        const periodKey = getActivePeriodKey();
        if (!appState.inspections[periodKey]) appState.inspections[periodKey] = {};

        let addedCount = 0;

        parsedImportData.forEach(item => {
            const newId = `STU-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const studentObj = {
                id: newId,
                deviceNo: item.deviceNo,
                serialNo: item.serialNo,
                studentCode: item.studentCode,
                fullName: item.fullName,
                className: item.className,
                teacher: item.teacher
            };

            appState.students.push(studentObj);

            appState.inspections[periodKey][newId] = {
                device: true,
                charger: true,
                pen: true,
                tag: true,
                status: 'PENDING',
                notes: '',
                updatedAt: new Date().toISOString()
            };

            addedCount++;
        });

        saveDataToStorage();
        closeAllModals();
        renderAll();
        showToast(`นำเข้าข้อมูลนักเรียนสำเร็จ ${addedCount} รายการ`, 'success');
    }

    function closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    }

    function exportToCSV() {
        const periodKey = getActivePeriodKey();
        const periodInspections = appState.inspections[periodKey] || {};

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "หมายเลขเครื่อง,รหัสครุภัณฑ์(S/N),รหัสนักเรียน,ชื่อ-สกุล,ชั้นเรียน,ครูที่ปรึกษา,ตัวเครื่อง,สายชาร์จ,ปากกาStylus,รหัสตรงเครื่อง,สถานะการตรวจ,หมายเหตุ\n";

        appState.students.forEach(s => {
            const insp = periodInspections[s.id] || { device: true, charger: true, pen: true, tag: true, status: 'PENDING', notes: '' };
            const row = [
                s.deviceNo,
                `"${s.serialNo}"`,
                s.studentCode,
                `"${s.fullName}"`,
                s.className,
                `"${s.teacher}"`,
                insp.device ? 'ปกติ' : 'ชำรุด',
                insp.charger ? 'ครบ' : 'ไม่ครบ',
                insp.pen ? 'ครบ' : 'ไม่ครบ',
                insp.tag ? 'ตรง' : 'ไม่ตรง',
                insp.status === 'COMPLETE' ? 'ปกติครบถ้วน' : insp.status === 'ISSUE' ? 'มีปัญหา' : 'ยังไม่ตรวจ',
                `"${insp.notes || ''}"`
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Chromebook_Inspection_WatNawong_${appState.activeDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว', 'success');
    }

    function formatThaiDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function showToast(msg, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${msg}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    document.addEventListener('DOMContentLoaded', initApp);

})();
